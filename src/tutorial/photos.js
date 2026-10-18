const openDB=()=>new Promise((resolve,reject)=>{const request=window.indexedDB.open('rethread-tutorial-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Photo storage is unavailable. Tutorial progress is still saved separately.'));request.onblocked=()=>reject(Error('Close other ReThread tabs and retry saving the photo.'));});
export async function photoOperation(projectId,kind,action,file){
 const db=await openDB();try{return await new Promise((resolve,reject)=>{const transaction=db.transaction('photos',action==='get'?'readonly':'readwrite'),store=transaction.objectStore('photos'),key=`${projectId}:${kind}`;
 const request=action==='get'?store.get(key):action==='delete'?store.delete(key):store.put(file,key);let value;
 request.onsuccess=()=>{value=request.result;};transaction.oncomplete=()=>resolve(value);transaction.onerror=()=>reject(Error('The photo could not be saved. Browser photo storage may be full.'));transaction.onabort=()=>reject(Error('Photo storage was interrupted. Please retry.'));
 });}finally{db.close();}
}
