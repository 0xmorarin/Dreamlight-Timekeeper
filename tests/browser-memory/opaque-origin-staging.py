#!/usr/bin/env python3
"""Optional Chromium emergency-environment Worker staging only.

Use only when administrator policy blocks localhost/file pages. Tests synthetic
JSON parse/clone/serialize in about:blank. It CANNOT exercise P1G, AES, Deflate,
secure-context WebCrypto, UI Worker wiring or browser peak RSS.
Requires Python Playwright and a local Chromium binary.
"""
import argparse
import json
import os
from pathlib import Path
import re
import threading
import time

def run(executable, sizes):
 from playwright.sync_api import sync_playwright
 try:
  import psutil
 except ImportError:
  psutil=None
 baseline={p.pid for p in psutil.process_iter(["pid"])} if psutil else set()
 readings=[];stop=threading.Event()
 def sample():
  while not stop.wait(.03):
   count=total=0
   for p in psutil.process_iter(["pid","name"]):
    try:
     if p.pid in baseline or not re.search("chrom|chrome",p.info.get("name",""),re.I):continue
     count+=1;total+=p.memory_info().rss
    except (psutil.Error,OSError,ValueError):pass
   readings.append({"rssSumBytes":total,"processes":count})
 if psutil:threading.Thread(target=sample,daemon=True).start()
 results=[]
 try:
  with sync_playwright() as pw:
   browser=pw.chromium.launch(headless=True,executable_path=executable)
   try:
    page=browser.new_page()
    for mib in sizes:
     result=page.evaluate("""async mib => {
      const start=performance.now();
      const script = 'self.onmessage=e=>{const t=performance.now();'+
        'const parsed=JSON.parse(e.data);const copy=structuredClone(parsed);'+
        'const text=JSON.stringify(copy);'+
        'self.postMessage({chars:text.length,workerMs:performance.now()-t,writerAuthorized:false});}';
      const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
      const worker=new Worker(url);
      try {
       const data=JSON.stringify({GameInfo:{Version:626},
        SyntheticOpaque:'X'.repeat(mib*1024*1024)});
       const value=await new Promise((resolve,reject)=>{
        worker.onmessage=e=>resolve(e.data);
        worker.onerror=e=>reject(Error(e.message));
        worker.postMessage(data);
       });
       return {...value,mib,elapsedMs:performance.now()-start,
        isSecureContext:isSecureContext,webCryptoSubtleAvailable:!!crypto.subtle,
        exactCodecExecuted:false,peakMeasured:false};
      } finally {worker.terminate();URL.revokeObjectURL(url);}
     }""",mib)
     if result["writerAuthorized"] or result["exactCodecExecuted"]:raise RuntimeError("STAGING_ONLY_INVARIANT")
     results.append(result)
   finally:browser.close()
 finally:stop.set()
 values=[x["rssSumBytes"] for x in readings if x["processes"]>0]
 return {"kind":"OPAQUE_ORIGIN_SYNTHETIC_WORKER_STAGING_ONLY",
  "results":results,"rssMethod":"30MS_SAMPLED_SUM_WITH_SHARED_PAGE_DOUBLE_COUNT",
  "rssMaxObservedBytes":max(values,default=None),
  "rssSampleCount":len(values),"browserCodecAccepted":False,
  "browserPeakAccepted":False,"releaseAuthorized":False}

if __name__=="__main__":
 parser=argparse.ArgumentParser()
 parser.add_argument("--chromium-executable",default=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"))
 parser.add_argument("--mib",type=int,nargs="*",default=[1,4,12])
 args=parser.parse_args()
 if not args.mib or any(not 1<=n<=24 for n in args.mib):
  parser.error("Only synthetic MiB sizes 1..24")
 print(json.dumps(run(args.chromium_executable,args.mib)))
