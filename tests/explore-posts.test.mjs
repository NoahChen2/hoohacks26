import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePost,postToProject,suggestUsername,estimatedTime} from '../src/explore/posts.js';
import {filterProjects} from '../src/explore/projects.js';

const fields={title:'  Flannel to cropped jacket ',description:'Cut and rebound.',username:'Mila.Mends',aesthetic:'Vintage',difficulty:'Beginner',hours:'1.5',kind:'jacket',tools:['Iron','Laser cutter'],materials:'- Old flannel\n\n• Thread',steps:'1. Unpick the hem\n2) Bind the edge\n'};
const row={id:'0f8fad5b-d9cb-469f-a165-70867728950e',user_id:'7c9e6679-7425-40de-944b-e07fc1f90ae7',username:'mila.mends',title:'Flannel to cropped jacket',description:'Cut and rebound.',aesthetic:'Vintage',difficulty:'Beginner',hours:1.5,kind:'jacket',color:'#aa3322',tools:['Iron'],materials:['Old flannel'],steps:['Unpick the hem'],image_path:'7c9e6679-7425-40de-944b-e07fc1f90ae7/16fd2706-8baf-433b-82eb-8c7fada847da.jpg',image_width:1200,image_height:1500,created_at:'2026-10-18T12:00:00Z'};

test('post fields are trimmed, list prefixes removed and unknown tools dropped',()=>{
  const post=validatePost(fields);
  assert.equal(post.title,'Flannel to cropped jacket');assert.equal(post.username,'mila.mends');assert.equal(post.hours,1.5);
  assert.deepEqual(post.steps,['Unpick the hem','Bind the edge']);assert.deepEqual(post.materials,['Old flannel','Thread']);assert.deepEqual(post.tools,['Iron']);
  assert.equal(validatePost({...fields,kind:'spaceship'}).kind,null);
});
test('invalid posts explain what to fix',()=>{
  assert.throws(()=>validatePost({...fields,title:' '}),/title/);
  assert.throws(()=>validatePost({...fields,steps:'\n \n'}),/step/);
  assert.throws(()=>validatePost({...fields,username:'<b>x</b>'}),/name/);
  assert.throws(()=>validatePost({...fields,aesthetic:'Goth'}),/style/);
  assert.throws(()=>validatePost({...fields,hours:'0'}),/hours/);
});
test('a posts row becomes a feed project that try-on, tutorial and search can use',()=>{
  const p=postToProject(row,'https://cdn.example/x.jpg');
  assert.equal(p.id,`post-${row.id}`);assert.equal(p.source,'community');assert.equal(p.height,500);assert.equal(p.estimatedTime,'1.5 hours');
  assert.deepEqual(p.art,{cloth:'#aa3322'});assert.equal(p.kind,'jacket');assert.ok(p.safetyNotes.length);assert.deepEqual(p.tags,['Vintage','Old flannel']);
  assert.deepEqual(filterProjects('flannel','Vintage',false,[],[p]),[p]);
});
test('rows this app did not write are ignored instead of rendered',()=>{
  for(const bad of [{image_path:'../evil.jpg'},{image_path:'x" onerror="alert(1)'},{username:'<img src=x>'},{aesthetic:'Goth'},{steps:[]},{id:'1'}])assert.equal(postToProject({...row,...bad},'u'),null);
  assert.equal(postToProject({...row,kind:'rocket',color:'red'},'u').kind,'project');
  assert.equal(postToProject({...row,color:'red'},'u').art,undefined);
});
test('usernames and times read naturally',()=>{
  assert.equal(suggestUsername('Noah.Chen+x@gmail.com'),'noah.chenx');assert.equal(suggestUsername('a@b.c'),'maker');
  assert.equal(estimatedTime(0.5),'30 minutes');assert.equal(estimatedTime(1),'1 hour');assert.equal(estimatedTime(3),'3 hours');
});
