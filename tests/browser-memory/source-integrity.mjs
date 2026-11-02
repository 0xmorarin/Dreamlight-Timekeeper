// Synthetic browser test helper: compare actual bytes before transferable detachment.
// Never accept length-only equality or transfer mode as evidence.
export function bytesEqual(a,b) {
 if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array))return false;
 if(a.byteLength!==b.byteLength)return false;
 for(let i=0;i<a.byteLength;i++)if(a[i]!==b[i])return false;
 return true;
}
