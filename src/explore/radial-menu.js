import {createElement,Pin,Heart,Search,Share2,X} from 'lucide';
import {escape} from './ui.js';
const nodes={pin:Pin,heart:Heart,search:Search,share:Share2,close:X};
export const lucideIcon=name=>createElement(nodes[name],{'aria-hidden':'true',width:22,height:22,'stroke-width':1.8}).outerHTML;
export function radialActionMenu(project,state){
  const liked=state.liked.includes(project.id),saved=state.saved.includes(project.id);
  const entries=[
    {name:'Save to Board',icon:'pin',attributes:`data-board-project="${project.id}"`,active:saved},
    {name:'Share',icon:'share',attributes:`data-share-project="${project.id}"`},
    {name:liked?'Unfavorite':'Favorite',icon:'heart',attributes:`data-kind="liked" data-id="${project.id}" aria-pressed="${liked}"`,active:liked},
    {name:'Visual Search',icon:'search',attributes:`data-visual-search="${project.id}"`},
  ];
  return entries.map((action,i)=>`<div class="radial-slot" data-radial-slot="${i}"><button type="button" class="radial-action ${action.active?'is-active':''}" ${action.attributes} aria-label="${escape(action.name)}" title="${escape(action.name)}" style="--stagger:${i*30}ms">${lucideIcon(action.icon)}<span class="radial-tooltip">${escape(action.name)}</span></button></div>`).join('');
}
