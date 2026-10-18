import {escape,icon} from './ui.js';
export function boardCard(board,projects){
  const covers=board.items.map(item=>projects.find(p=>p.id===item.projectId)).filter(Boolean).slice(0,4);
  return `<a class="saved-board-card" href="/profile?board=${encodeURIComponent(board.id)}"><div class="board-collage ${covers.length?'':'is-empty'}">${covers.length?covers.map(p=>`<img src="${p.cover}" alt=""/>`).join(''):icon('save')}</div><div><h3>${escape(board.name)}</h3><span>${board.items.length} ${board.items.length===1?'project':'projects'}</span></div></a>`;
}
export function renderProfile(target,{library,projects,renderCard,boardId}){
  document.title='Your saved boards — ReThread';
  if(boardId){
    const board=library.boards.find(b=>b.id===boardId);
    if(!board){target.innerHTML='<div class="project-not-found"><h1>Board not found</h1><a class="primary-link" href="/profile">Back to your boards</a></div>';return;}
    const saved=board.items.map(item=>projects.find(p=>p.id===item.projectId)).filter(Boolean);
    target.innerHTML=`<a class="back-link" href="/profile">${icon('arrow')} All saved boards</a><section class="boards-heading"><p class="eyebrow">YOUR COLLECTION</p><h1>${escape(board.name)}</h1><p>${saved.length} ${saved.length===1?'idea':'ideas'} for a second life.</p></section><section class="masonry-feed board-gallery" aria-label="Saved project gallery">${saved.length?saved.map((p,i)=>`<div class="board-gallery-item">${renderCard(p,i)}<button type="button" class="board-project-remove" data-remove-board="${board.id}" data-project="${p.id}" aria-label="Remove ${escape(p.title)} from ${escape(board.name)}">Remove from board</button></div>`).join(''):'<div class="feed-empty"><h2>Your next project belongs here.</h2><p>Save an idea to this board from any project image.</p><a class="primary-link" href="/explore">Explore projects ↗</a></div>'}</section>`;
    return;
  }
  target.innerHTML=`<section class="boards-heading"><p class="eyebrow">YOUR CREATIVE CORNER</p><h1>A little inspiration,<br/><em>kept for later.</em></h1><p>Guest profile · Your favorites and boards live in this browser.</p></section><section class="saved-boards-section" aria-labelledby="saved-boards-title"><div class="section-title"><h2 id="saved-boards-title">Saved Boards</h2><span>${library.boards.length} collections</span></div><form class="profile-board-create" data-create-profile-board><label class="sr-only" for="profile-board-name">New board name</label><input id="profile-board-name" name="board-name" maxlength="60" placeholder="Name a new board…" required/><button type="submit">${icon('plus')} Create board</button><p class="board-form-error" role="status"></p></form><div class="saved-boards-grid">${library.boards.map(b=>boardCard(b,projects)).join('')}</div></section><section class="profile-favorites"><div class="section-title"><h2>Your favorites</h2><span>${library.liked.filter(id=>projects.some(p=>p.id===id)).length} projects</span></div><div class="masonry-feed">${projects.filter(p=>library.liked.includes(p.id)).map(renderCard).join('')||'<p class="profile-empty">Tap the heart on an image to keep your favorites here.</p>'}</div></section>`;
}
