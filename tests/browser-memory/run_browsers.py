#!/usr/bin/env python3
"""Optional REAL-browser synthetic P1G read-only probe. Not part of Node CI.
Requires pip install playwright psutil; browser binaries installed separately.
Examples:
 python tests/browser-memory/run_browsers.py --browser chromium --mib 4
 python tests/browser-memory/run_browsers.py --browser all --mib 1
No private save paths are accepted. Does not perform any encode/export.
"""
import argparse
import functools
import json
import mimetypes
import os
from pathlib import Path
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT=Path(__file__).resolve().parents[2]
ALLOW={
 "/tests/browser-memory/index.html",
 "/tests/browser-memory/p1g-read-worker.mjs",
 "/tests/browser-memory/source-integrity.mjs",
 "/src/core/p1g-packaged-profile-codec.mjs",
 "/src/core/p1g-envelope-audit.mjs",
 "/src/core/safe-edit-session.mjs",
 "/src/core/versioning.mjs"
}
mimetypes.add_type("text/javascript",".mjs")
class LocalHandler(BaseHTTPRequestHandler):
 fixture=b""
 def do_GET(self):
  path=self.path.split("?",1)[0]
  if path=="/synthetic.p1g":
   body=self.fixture;mime="application/octet-stream"
  elif path in ALLOW:
   candidate=ROOT/path.lstrip("/")
   body=candidate.read_bytes();mime=mimetypes.guess_type(candidate.name)[0] or "text/plain"
  else:
   self.send_error(404,"Probe serves only synthetic fixture and allowlisted code");return
  self.send_response(200)
  for k,v in [
   ("Content-Type",mime),("Content-Length",str(len(body))),
   ("Cross-Origin-Opener-Policy","same-origin"),
   ("Cross-Origin-Embedder-Policy","require-corp"),
   ("Cross-Origin-Resource-Policy","same-origin"),
   ("Cache-Control","no-store"),("X-Content-Type-Options","nosniff")
  ]:self.send_header(k,v)
  self.end_headers()
  self.wfile.write(body)
 def log_message(self,fmt,*args):pass

class SampledProcessRSS:
 """Aggregate RSS across newly spawned browser processes; sampling misses spikes.
 Shared pages can be counted more than once, NOT exact process peak / heap.
 """
 def __init__(self,pattern):
  self.pattern=pattern
  self.stop=threading.Event()
  self.samples=[]
  self.available=False
  try:
   import psutil
   self.psutil=psutil
   self.baseline={p.pid for p in psutil.process_iter(["pid"])}
   self.available=True
  except ImportError:
   self.psutil=None
 def __enter__(self):
  if self.available:
   self.thread=threading.Thread(target=self._loop,daemon=True)
   self.thread.start()
  return self
 def _loop(self):
  while not self.stop.wait(0.03):
   total=0;count=0
   for process in self.psutil.process_iter(["pid","name"]):
    try:
     if process.pid in self.baseline:continue
     if not self.pattern.search(process.info.get("name","")):continue
     total+=process.memory_info().rss;count+=1
    except(self.psutil.Error,OSError,ValueError):continue
   self.samples.append({"tNs":time.monotonic_ns(),"rssSumBytes":total,"processes":count})
 def __exit__(self,*exc):
  self.stop.set()
  if self.available:self.thread.join(timeout=2)
 def report(self):
  values=[s for s in self.samples if s["processes"]>0]
  return {
   "method":"OS_PROCESS_RSS_SUM_SAMPLED_30MS_NOT_EXACT_PEAK",
   "available":self.available,
   "sampleCount":len(values),
   "maxObservedRssSumBytes":max([s["rssSumBytes"] for s in values],default=None),
   "maxObservedProcessCount":max([s["processes"] for s in values],default=None),
   "sharedPagesMayBeDoubleCounted":True
  }

def run(args):
 from playwright.sync_api import sync_playwright
 raw=subprocess.run(
  ["node",str(ROOT/"tests/browser-memory/synthetic-fixture.mjs"),str(args.mib)],
  capture_output=True,check=True,timeout=45).stdout
 LocalHandler.fixture=raw
 server=ThreadingHTTPServer(("127.0.0.1",0),LocalHandler)
 thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
 endpoint=f"http://127.0.0.1:{server.server_port}/tests/browser-memory/index.html"
 reports={}
 try:
  with sync_playwright() as pw:
   for name in (["chromium","firefox","webkit"] if args.browser=="all" else [args.browser]):
    regex=re.compile(r"chrom|chrome" if name=="chromium" else
      ("firefox" if name=="firefox" else "WebKit|MiniBrowser"),re.I)
    with SampledProcessRSS(regex) as samples:
     browser=None
     try:
      options={"headless":True}
      if name=="chromium" and args.chromium_executable:
       options["executable_path"]=args.chromium_executable
      browser=getattr(pw,name).launch(**options)
      page=browser.new_page()
      page.set_default_timeout(120000)
      page.goto(endpoint,wait_until="load")
      page.wait_for_function("typeof window.syntheticBrowserProbe === 'object'")
      features=page.evaluate("() => window.syntheticBrowserProbe.features()")
      mutated=page.evaluate("() => window.syntheticBrowserProbe.negativeSameLengthMutationTest()")
      if mutated != {"sameLength":True,"rejected":True,"originalUnchanged":True}:
       raise RuntimeError("SAME_LENGTH_MUTATION_NOT_REJECTED")
      clone=page.evaluate("() => window.syntheticBrowserProbe.begin('clone')")
      transfer=page.evaluate("() => window.syntheticBrowserProbe.begin('transfer')")
      switched=page.evaluate("() => window.syntheticBrowserProbe.switchSession()")
      for result in (clone,transfer,switched["subsequent"]):
       if not result.get("readOnly") or result.get("writerAuthorized") or result.get("editedCopyAuthorized"):
        raise RuntimeError("WRITER_AUTHORIZATION_OR_READ_INVARIANT_FAILED")
       if result.get("schema")!=626 or result.get("browserPeakAccepted"):
        raise RuntimeError("SCHEMA_OR_BROWSER_PEAK_ASSERTION_FAILED")
       for flag in ["preSendExactByteMatch","preSendSha256Match",
        "originalSourceSha256Unchanged","workerReceivedSourceSha256Match"]:
        if result.get(flag) is not True:
         raise RuntimeError("SYNTHETIC_SOURCE_EVIDENCE_MISSING_"+flag)
       if result.get("sourceHashBefore")!=result.get("sourceHashAfter"):
        raise RuntimeError("ORIGINAL_SOURCE_HASH_DRIFT")
      if not transfer.get("transferDetached"):
       raise RuntimeError("TRANSFER_BUFFER_NOT_DETACHED")
      if transfer.get("sentInputPostSendByteComparison")!="NOT_POSSIBLE_DETACHED":
       raise RuntimeError("TRANSFER_DETACHED_SOURCE_CANNOT_BE_COMPARED")
      if switched.get("staleResponseAccepted") or not switched.get("terminated"):
       raise RuntimeError("SESSION_SWITCH_INVARIANT_FAILED")
      # UA-specific memory is optional and not a measured, continuous peak.
      memory=page.evaluate("""async () => {
        if(typeof performance.measureUserAgentSpecificMemory!=='function')
          return {status:'UNAVAILABLE'};
        return await Promise.race([
          performance.measureUserAgentSpecificMemory().then(x=>({status:'SINGLE_MEASUREMENT',bytes:x.bytes})).
            catch(e=>({status:'ERROR',name:e.name})),
          new Promise(resolve=>setTimeout(()=>resolve({status:'TIMED_OUT'}),6000))
        ]);
      }""")
      reports[name]={"status":"SYNTHETIC_BROWSER_READ_PASS",
       "features":features,"sameLengthMutation":mutated,"clone":clone,"transfer":transfer,
       "sessionSwitch":switched,"userAgentSpecificMemory":memory,
       "browserPeakMemoryAccepted":False,
       "realSaveWriteAccepted":False}
     except Exception as exc:
      reports[name]={"status":"UNAVAILABLE_OR_TEST_FAILED",
       "exceptionType":type(exc).__name__,
       "reason":str(exc).splitlines()[0][:240],
       "browserPeakMemoryAccepted":False}
     finally:
      if browser:browser.close()
    reports[name]["processRss"]=samples.report()
    reports[name]["rssValidSampleCount"]=reports[name]["processRss"]["sampleCount"]
    reports[name]["rssPeakAccepted"]=False
    if reports[name]["processRss"]["sampleCount"]==0:
     reports[name]["rssEvidenceStatus"]="NO_VALID_RSS_SAMPLES"
    else:
     reports[name]["rssEvidenceStatus"]="SAMPLED_PROCESS_SUM_NOT_EXACT_PEAK"
 finally:
  server.shutdown();server.server_close()
 return {"scenario":"SYNTHETIC_ONLY_NO_REAL_SAVE","mib":args.mib,
  "host":"127.0.0.1","memoryAccuracy":"SAMPLED_NOT_EXACT_PEAK",
  "testResults":reports,"releaseAuthorized":False}

if __name__=="__main__":
 parser=argparse.ArgumentParser()
 parser.add_argument("--browser",choices=["chromium","firefox","webkit","all"],default="all")
 parser.add_argument("--mib",type=int,default=1)
 parser.add_argument("--chromium-executable",default=os.environ.get("CHROMIUM_PATH"))
 args=parser.parse_args()
 if not 1<=args.mib<=24:parser.error("--mib must be in [1,24]")
 try:
  print(json.dumps(run(args),ensure_ascii=False))
 except Exception as error:
  parser.exit(1,"SYNTHETIC_BROWSER_PROBE_ERROR: "+str(error)+"\n")
