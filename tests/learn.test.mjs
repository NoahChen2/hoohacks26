import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons,DIFFICULTIES} from '../src/learn/lessons.js';
import {gradeQuiz,loadLessonProgress,saveLessonProgress,submitLessonQuiz,LESSON_PROGRESS_PREFIX} from '../src/learn/progress.js';
import {awardProjectCompletion,saveProgress,getRewardSummary,awardLessonCompletion,LESSON_COMPLETION_PREFIX} from '../src/tutorial/store.js';
import {catalog as projects} from './fixtures/catalog.mjs';
import {lessonVisual} from '../src/learn/visuals.js';
const memory=()=>{const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const answers=lesson=>lesson.quiz.map(question=>question.answer);
test('academy contains all requested topics, complete written lessons, visual areas and five explained questions',()=>{
 assert.equal(lessons.length,11);assert.equal(new Set(lessons.map(x=>x.id)).size,11);
 assert.deepEqual(DIFFICULTIES.map(level=>lessons.filter(x=>x.difficulty===level).length),[5,3,3]);
 for(const lesson of lessons){assert.ok(lesson.title&&lesson.description&&lesson.minutes>0);assert.ok(lesson.explanation.length>=4);assert.equal(lesson.quiz.length,5);assert.match(lessonVisual(lesson),/<svg/);for(const question of lesson.quiz){assert.equal(question.options.length,3);assert.equal(new Set(question.options).size,3);assert.ok(question.explanation.length>20);assert.ok(question.answer>=0&&question.answer<3);}}
});
test('80 percent passes exactly, failed and incomplete quizzes cannot complete a lesson',()=>{
 const lesson=lessons[0],correct=answers(lesson);const four=[...correct];four[0]=(four[0]+1)%3;assert.deepEqual(gradeQuiz(lesson,four),{score:4,total:5,percent:80,passed:true});
 const three=[...four];three[1]=(three[1]+1)%3;assert.equal(gradeQuiz(lesson,three).passed,false);assert.throws(()=>gradeQuiz(lesson,[null,1,2,0,1]),/all five/);assert.throws(()=>gradeQuiz(lesson,[0,0,0,0,99]));
 const storage=memory();assert.throws(()=>awardLessonCompletion(storage,lesson,{score:3,total:5}));assert.throws(()=>awardLessonCompletion(storage,lesson,{score:4,total:4}));assert.equal(getRewardSummary(storage).xp,0);
});
test('partial answers survive refresh and damaged or invalid progress is handled safely',()=>{
 const storage=memory(),lesson=lessons[1],progress=loadLessonProgress(storage,lesson);progress.answers[2]=1;saveLessonProgress(storage,lesson,progress);assert.equal(loadLessonProgress(storage,lesson).answers[2],1);
 storage.setItem(LESSON_PROGRESS_PREFIX+lesson.id,JSON.stringify({answers:[-1,99,null,0,'1'],submitted:true,attempts:-10,bestScore:100}));assert.deepEqual(loadLessonProgress(storage,lesson),{version:1,answers:[null,null,null,0,null],submitted:false,attempts:0,bestScore:0});storage.setItem(LESSON_PROGRESS_PREFIX+lesson.id,'{');assert.equal(loadLessonProgress(storage,lesson).answers.length,5);
});
test('failure, retry, success and repeated practice award only one 50 XP / 20 currency record',()=>{
 const storage=memory(),lesson=lessons[0];let progress=loadLessonProgress(storage,lesson);progress.answers=answers(lesson).map(a=>(a+1)%3);let result=submitLessonQuiz(storage,lesson,progress);assert.equal(result.grade.passed,false);assert.equal(result.reward,null);assert.equal(result.progress.attempts,1);assert.equal(getRewardSummary(storage).xp,0);
 progress={...result.progress,answers:answers(lesson),submitted:false};result=submitLessonQuiz(storage,lesson,progress);assert.equal(result.reward.awarded,true);assert.equal(result.progress.bestScore,5);assert.equal(result.progress.attempts,2);
 const repeat=submitLessonQuiz(storage,lesson,{...result.progress,submitted:false});assert.equal(repeat.reward.awarded,false);assert.equal(getRewardSummary(storage).xp,50);assert.equal(getRewardSummary(storage).currency,20);assert.equal(getRewardSummary(storage).completedLessons,1);assert.equal(getRewardSummary(storage).garmentsReused,0);
});
test('lesson rewards combine with existing project rewards without changing completion or reuse counts',()=>{
 const storage=memory(),project=projects[0];saveProgress(storage,project,{steps:[0,1,2],tools:[],materials:[]});awardProjectCompletion(storage,project);const lesson=lessons[2];submitLessonQuiz(storage,lesson,{...loadLessonProgress(storage,lesson),answers:answers(lesson)});const summary=getRewardSummary(storage);assert.equal(summary.xp,150);assert.equal(summary.currency,60);assert.equal(summary.completedProjects,1);assert.equal(summary.completedLessons,1);assert.equal(summary.garmentsReused,1);
});
test('blocked storage never announces completion and corrupted reward records are not overwritten',()=>{
 const storage=memory(),lesson=lessons[0],progress={...loadLessonProgress(storage,lesson),answers:answers(lesson)};assert.throws(()=>submitLessonQuiz({...storage,setItem(){throw Error();}},lesson,progress),/could not save/);assert.equal(getRewardSummary(storage).xp,0);
 storage.setItem(LESSON_COMPLETION_PREFIX+lesson.id,'{');assert.throws(()=>awardLessonCompletion(storage,lesson,{score:5,total:5}),/could not be read/);assert.equal(storage.getItem(LESSON_COMPLETION_PREFIX+lesson.id),'{');
});
