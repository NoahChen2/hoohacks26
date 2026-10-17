import * as THREE from 'three';

export function addStudioStage(scene,renderer) {
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=512;
  const c=canvas.getContext('2d'),gradient=c.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,'#ccd6dd');gradient.addColorStop(.65,'#e6e9e8');gradient.addColorStop(1,'#f0ece5');c.fillStyle=gradient;c.fillRect(0,0,32,512);
  const backdrop=new THREE.CanvasTexture(canvas);backdrop.colorSpace=THREE.SRGBColorSpace;scene.background=backdrop;
  scene.fog=new THREE.Fog('#e2e7e6',5,13);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshLambertMaterial({color:'#d6dcdb'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.064;floor.receiveShadow=true;scene.add(floor);
  const podium=new THREE.Mesh(new THREE.CylinderGeometry(.77,.80,.06,96),new THREE.MeshLambertMaterial({color:'#efede6'}));podium.position.y=-.032;podium.receiveShadow=true;scene.add(podium);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.772,.006,8,96),new THREE.MeshLambertMaterial({color:'#8caaa9'}));rim.rotation.x=Math.PI/2;rim.position.y=-.008;scene.add(rim);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.653,96),new THREE.MeshBasicMaterial({color:'#b6c5c1',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.0005;scene.add(ring);
  // Baked soft contact shadow supplements directional shadows beneath the feet.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const sc=shadowCanvas.getContext('2d'),radial=sc.createRadialGradient(64,64,8,64,64,64);radial.addColorStop(0,'rgba(38,52,60,.22)');radial.addColorStop(1,'rgba(38,52,60,0)');sc.fillStyle=radial;sc.fillRect(0,0,128,128);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(.85,.65),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.set(0,.001,.04);scene.add(contact);
  const fill=new THREE.DirectionalLight('#c5dcff',.6);fill.position.set(-3,2,2);scene.add(fill);
}
