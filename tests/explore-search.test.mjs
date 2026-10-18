import test from 'node:test';
import assert from 'node:assert/strict';
import {selectionFromPoints,moveSelection,resizeSelection,pixelCrop} from '../src/explore/crop-geometry.js';
import {cosine,imageDescriptor,descriptorSimilarity,rankImages} from '../src/explore/image-similarity.js';
test('normalized crop drawing, moving, resizing and original-pixel mapping stay bounded',()=>{
  const selection=selectionFromPoints({x:.8,y:.9},{x:.2,y:.3});assert.ok(Math.abs(selection.width-.6)<1e-9);
  assert.equal(moveSelection(selection,5,-5).x,1-selection.width);assert.equal(moveSelection(selection,5,-5).y,0);
  const resized=resizeSelection({x:.2,y:.2,width:.5,height:.5},'se',{x:2,y:2});assert.deepEqual(resized,{x:.2,y:.2,width:.8,height:.8});
  assert.deepEqual(pixelCrop({x:.25,y:.2,width:.5,height:.6},400,600),{x:100,y:120,width:200,height:360});
});
test('actual image pixels determine similarity; filters and deterministic ranking do not invent scores',()=>{
  const pixels=(r,g,b)=>({width:8,height:8,data:new Uint8ClampedArray(Array.from({length:64},()=>[r,g,b,255]).flat())});
  const red=imageDescriptor(pixels(220,20,20)),blue=imageDescriptor(pixels(20,20,220));
  assert.ok(descriptorSimilarity(red,red)>descriptorSimilarity(red,blue));assert.equal(cosine([0,0],[1,1]),0);
  const index=[{project:{id:'blue',aesthetic:'Vintage',kind:'bag',difficulty:'Beginner'},descriptors:[blue]},{project:{id:'red',aesthetic:'Streetwear',kind:'tee',difficulty:'Advanced'},descriptors:[red]}];
  assert.equal(rankImages(red,index)[0].project.id,'red');assert.equal(rankImages(red,index,{beginner:true})[0].project.id,'blue');assert.deepEqual(rankImages(red,index,{kind:'dress'}),[]);assert.deepEqual(rankImages(red,index,{savedOnly:true,saved:[]}),[]);assert.equal(rankImages(red,index,{savedOnly:true,saved:['blue']})[0].project.id,'blue');
});
