import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutImageFocus} from '../src/explore/focus-layout.js';

test('focus placement and polar/grid menus stay bounded and never overlap at every breakpoint',()=>{
  for(const vw of [320,375,430,768,1024,1440])for(const vh of [320,640,844,1050])for(const width of [100,145,190,314,600])for(const ratio of [.55,1,1.6,2.4])for(const edge of ['top','left','right','bottom']){
    const source={left:edge==='left'?-12:edge==='right'?vw-width+12:vw*.3,top:edge==='top'?-70:edge==='bottom'?vh-40:vh*.25,width,height:width*ratio};
    const layout=layoutImageFocus(source,{width:vw,height:vh}),image=layout.image;
    assert.ok(image.left>=15.99&&image.top>=63.99);assert.ok(image.left+image.width<=vw-15.99);assert.ok(image.top+image.height<=vh-15.99);
    assert.ok(Math.abs(image.width/image.height-width/source.height)<1e-6);
    const half=layout.button/2;
    for(const p of layout.points){assert.ok(p.x-half>=15.99&&p.x+half<=vw-15.99);assert.ok(p.y-half>=63.99&&p.y+half<=vh-15.99);}
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      const a=layout.points[i],b=layout.points[j];
      // Axis-aligned touch target rectangles are disjoint with a visible gap.
      assert.ok(Math.abs(a.x-b.x)>=layout.button+11.99||Math.abs(a.y-b.y)>=layout.button+11.99);
    }
    assert.ok(layout.button>=48);
  }
});
test('side arc follows the Pinterest sweep and stays safe on phones and zoomed viewports',()=>{
  const source={left:500,top:200,width:314,height:400},desktop=layoutImageFocus(source,{width:1440,height:1050});assert.equal(desktop.mode,'arc');
  const [a,b,c,d]=desktop.points;assert.ok(a.y>b.y&&b.y>c.y&&c.y>d.y);assert.ok(a.x>b.x&&b.x<c.x&&c.x<d.x);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(b.x-c.x,b.y-c.y))<1e-8);
  const small=layoutImageFocus({left:18,top:400,width:136,height:190},{width:320,height:640});assert.equal(small.mode,'arc');
  const zoomed=layoutImageFocus(source,{left:50,top:100,width:375,height:500});assert.ok(zoomed.image.left>=66&&zoomed.image.top>=164);
  assert.ok(zoomed.points.every(p=>p.x>=90&&p.y>=188));
});
