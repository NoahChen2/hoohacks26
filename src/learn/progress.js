import {awardLessonCompletion} from '../tutorial/store.js';
export const LESSON_PROGRESS_PREFIX='rethread.academy.progress.v1.';
const keyFor=lesson=>{if(!/^[a-z0-9-]{1,100}$/.test(lesson.id))throw Error('Invalid lesson.');return LESSON_PROGRESS_PREFIX+lesson.id;};
export function gradeQuiz(lesson,answers){
 if(!Array.isArray(answers)||answers.length!==5||lesson.quiz.length!==5||answers.some((answer,i)=>!Number.isInteger(answer)||answer<0||answer>=lesson.quiz[i].options.length))throw Error('Answer all five questions before checking your quiz.');
 const score=lesson.quiz.filter((question,i)=>question.answer===answers[i]).length;return {score,total:5,percent:score*20,passed:score>=4};
}
export function loadLessonProgress(storage,lesson){
 let raw={};try{raw=JSON.parse(storage.getItem(keyFor(lesson))||'{}')||{};}catch{/* Leave damaged snapshots untouched until an explicit edit. */}
 const answers=lesson.quiz.map((q,i)=>Number.isInteger(raw.answers?.[i])&&raw.answers[i]>=0&&raw.answers[i]<q.options.length?raw.answers[i]:null);
 return {version:1,answers,attempts:Number.isSafeInteger(raw.attempts)&&raw.attempts>=0?raw.attempts:0,bestScore:Number.isInteger(raw.bestScore)&&raw.bestScore>=0&&raw.bestScore<=5?raw.bestScore:0,submitted:raw.submitted===true&&answers.every(x=>x!==null)};
}
export function saveLessonProgress(storage,lesson,progress){try{storage.setItem(keyFor(lesson),JSON.stringify({...progress,version:1,updatedAt:new Date().toISOString()}));}catch{throw Error('Your browser could not save this lesson. Check storage and try again.');}}
export function submitLessonQuiz(storage,lesson,progress){
 const grade=gradeQuiz(lesson,progress.answers),next={...progress,attempts:progress.attempts+1,bestScore:Math.max(progress.bestScore,grade.score),submitted:true};
 saveLessonProgress(storage,lesson,next);
 const reward=grade.passed?awardLessonCompletion(storage,lesson,grade):null;
 return {progress:next,grade,reward};
}
