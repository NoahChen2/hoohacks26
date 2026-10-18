import {escape,icon} from './ui.js';

export function createBoardDialog({getLibrary,onMembership,onCreate,projects}){
  const dialog=document.createElement('dialog');dialog.className='board-dialog';dialog.setAttribute('aria-labelledby','board-dialog-title');document.body.appendChild(dialog);
  let project=null,returnFocus=null,scrollPosition=0;
  function rows(){
    const slot=dialog.querySelector('.board-dialog-list');
    slot.innerHTML=getLibrary().boards.map(board=>{
      const saved=board.items.some(item=>item.projectId===project.id),covers=board.items.map(item=>projects.find(p=>p.id===item.projectId)).filter(Boolean);
      return `<label class="board-choice"><span class="board-choice-cover">${covers[0]?`<img src="${covers[0].cover}" alt=""/>`:icon('save')}</span><span><strong>${escape(board.name)}</strong><small>${board.items.length} ${board.items.length===1?'project':'projects'}</small></span><input type="checkbox" data-board-choice="${board.id}" ${saved?'checked':''} aria-label="Save to ${escape(board.name)}"/></label>`;
    }).join('');
  }
  function close(){dialog.close();}
  dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('[data-close-board]')||event.target===dialog)close();});
  dialog.addEventListener('change',event=>{
    const input=event.target.closest('[data-board-choice]');if(!input)return;
    try{onMembership(input.dataset.boardChoice,project.id,input.checked);rows();dialog.querySelector(`[data-board-choice="${input.dataset.boardChoice}"]`).focus();}
    catch(error){dialog.querySelector('.board-form-error').textContent=error.message;input.checked=!input.checked;}
  });
  dialog.addEventListener('submit',event=>{
    event.preventDefault();const input=dialog.querySelector('[name="board-name"]');
    try{const board=onCreate(input.value,project.id);input.value='';dialog.querySelector('.board-form-error').textContent='';rows();dialog.querySelector(`[data-board-choice="${board.id}"]`).focus();}
    catch(error){dialog.querySelector('.board-form-error').textContent=error.message;input.focus();}
  });
  dialog.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key!=='Tab')return;
    const focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  dialog.addEventListener('close',()=>{
    document.body.classList.remove('board-dialog-open');window.scrollTo(0,scrollPosition);
    const fallback=document.querySelector(`[data-board-project="${project?.id}"]`);
    (returnFocus?.isConnected?returnFocus:fallback)?.focus({preventScroll:true});
  });
  return {
    open(p,trigger){project=p;returnFocus=trigger;scrollPosition=window.scrollY;document.body.classList.add('board-dialog-open');dialog.innerHTML=`<div class="board-dialog-head"><div><p class="eyebrow">KEEP THE INSPIRATION</p><h2 id="board-dialog-title">Save to a board</h2></div><button type="button" class="board-close" data-close-board aria-label="Close save to board">${icon('close')}</button></div><div class="board-project-preview"><img src="${p.cover}" alt=""/><p>${escape(p.title)}<small>Choose one or more boards. Uncheck to remove.</small></p></div><div class="board-dialog-list"></div><form class="board-create-form"><label for="new-board-name">Create a new board</label><div><input id="new-board-name" name="board-name" maxlength="60" required placeholder="e.g. Weekend sewing" autocomplete="off"/><button class="board-create-button" type="submit">Create & save</button></div><p class="board-form-error" role="status"></p></form><p class="board-feedback" role="status"></p><button type="button" class="board-done" data-close-board>Done</button>`;rows();dialog.showModal();},
    refresh(){if(dialog.open&&project){const focused=dialog.querySelector(':focus')?.dataset.boardChoice;rows();if(focused)dialog.querySelector(`[data-board-choice="${focused}"]`)?.focus();}},
  };
}
