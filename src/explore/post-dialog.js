// "Share your project": sign in if needed, then post a photo and guide to Explore.
import {escape,icon} from './ui.js';
import {POST_AESTHETICS,POST_DIFFICULTIES,POST_TOOLS,POST_KINDS,currentUser,signIn,signOut,publishPost,prepareImage,suggestUsername,friendlyError} from './community.js';

const NAME_KEY='rethread.explore.username';
const options=(list,selected)=>list.map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${escape(label)}</option>`).join('');
const pairs=list=>list.map(value=>[value,value]);

export function createPostDialog({storage,onPublished}){
  const dialog=document.createElement('dialog');dialog.className='post-dialog';dialog.setAttribute('aria-labelledby','post-dialog-title');document.body.appendChild(dialog);
  let returnFocus=null,image=null,previewUrl='',busy=false;
  const head=(eyebrow,title)=>`<div class="post-dialog-head"><div><p class="eyebrow">${eyebrow}</p><h2 id="post-dialog-title">${title}</h2></div><button type="button" class="post-close" data-close-post aria-label="Close">${icon('close')}</button></div>`;
  const status=(text,kind='error')=>{const slot=dialog.querySelector('[data-post-status]');if(slot){slot.textContent=text;slot.dataset.kind=kind;}};
  function savedName(user){try{return storage.getItem(NAME_KEY)||suggestUsername(user.email);}catch{return suggestUsername(user.email);}}

  function renderAuth(mode='signin'){
    dialog.innerHTML=`${head('SHARE WITH EVERYONE',mode==='signin'?'Sign in to post':'Create your account')}<form class="post-auth" novalidate><p class="post-help">Posts show up on Explore for everyone, with your name on them.</p><label>Email<input type="email" name="email" autocomplete="email" required/></label><label>Password<input type="password" name="password" minlength="6" autocomplete="${mode==='signin'?'current-password':'new-password'}" required/></label><p class="post-status" data-post-status role="status"></p><button type="submit" class="post-submit">${mode==='signin'?'Sign in':'Create account'}</button><button type="button" class="post-link" data-auth-mode="${mode==='signin'?'signup':'signin'}">${mode==='signin'?'New here? Create an account':'Have an account? Sign in'}</button></form>`;
    const form=dialog.querySelector('form');
    dialog.querySelector('[data-auth-mode]').addEventListener('click',event=>renderAuth(event.currentTarget.dataset.authMode));
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const email=form.email.value.trim(),password=form.password.value;
      if(!/^\S+@\S+\.\S+$/.test(email))return status('Enter a valid email address.');
      if(password.length<6)return status('Password must be at least 6 characters.');
      const button=form.querySelector('.post-submit');button.disabled=true;status('');
      try{
        const user=await signIn(email,password,mode==='signup');
        if(user)renderComposer(user);else status(`Check ${email} for a confirmation link, then sign in here.`,'info');
      }catch(error){status(friendlyError(error));}finally{if(button.isConnected)button.disabled=false;}
    });
    form.email.focus();
  }

  function renderComposer(user){
    image=null;
    dialog.innerHTML=`${head('SHARE WITH EVERYONE','Post your project')}<form class="post-form" novalidate>
      <label class="post-photo"><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required/><span class="post-photo-empty">${icon('plus')}<strong>Add a photo</strong><small>JPEG, PNG or WebP</small></span><img alt="Your project photo" hidden/></label>
      <label>Title<input name="title" maxlength="120" required placeholder="e.g. Old flannel to cropped jacket" autocomplete="off"/></label>
      <label>What did you make?<textarea name="description" rows="3" maxlength="2000" placeholder="The garment you started with and what you turned it into."></textarea></label>
      <div class="post-row"><label>Style<select name="aesthetic">${options(pairs(POST_AESTHETICS),'Streetwear')}</select></label><label>Skill level<select name="difficulty">${options(pairs(POST_DIFFICULTIES),'Beginner')}</select></label><label>Hours<input type="number" name="hours" min="0.25" max="200" step="0.25" value="2" required/></label></div>
      <label>Garment, for 3D try-on<select name="kind"><option value="">Not wearable (bag, decor…)</option>${options(POST_KINDS,'')}</select></label>
      <label>Steps <small>One per line</small><textarea name="steps" rows="5" required placeholder="Unpick the side seams.&#10;Pin the new panel in place.&#10;Topstitch and press."></textarea></label>
      <label>Materials <small>One per line</small><textarea name="materials" rows="3" placeholder="Old flannel shirt&#10;Matching thread"></textarea></label>
      <fieldset><legend>Tools</legend><div class="post-tools">${POST_TOOLS.map(tool=>`<label><input type="checkbox" name="tools" value="${escape(tool)}"/>${escape(tool)}</label>`).join('')}</div></fieldset>
      <label>Your name on Explore<input name="username" value="${escape(savedName(user))}" maxlength="30" required autocomplete="nickname" pattern="[a-z0-9._]{2,30}"/></label>
      <p class="post-status" data-post-status role="status"></p>
      <button type="submit" class="post-submit">Post to Explore</button>
      <p class="post-signed-in">Signed in as ${escape(user.email||'your account')} · <button type="button" class="post-link" data-sign-out>Sign out</button></p>
    </form>`;
    const form=dialog.querySelector('form'),preview=form.querySelector('.post-photo img');
    form.photo.addEventListener('change',async()=>{
      image=null;status('');
      try{
        image=await prepareImage(form.photo.files[0]);
        if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(image.blob);
        preview.src=previewUrl;preview.hidden=false;form.querySelector('.post-photo').classList.add('has-photo');
      }catch(error){form.photo.value='';status(error.message);}
    });
    dialog.querySelector('[data-sign-out]').addEventListener('click',async()=>{await signOut().catch(()=>{});renderAuth();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      if(!image)return status('Add a photo of your project.');
      const data=new FormData(form),fields={...Object.fromEntries(data),tools:data.getAll('tools')};
      const button=form.querySelector('.post-submit');busy=true;button.disabled=true;button.textContent='Posting…';status('');
      try{
        const project=await publishPost(fields,image);
        try{storage.setItem(NAME_KEY,project.username);}catch{/* The name is only a convenience. */}
        dialog.close();onPublished(project);
      }catch(error){status(friendlyError(error));}
      finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='Post to Explore';}}
    });
    form.title.focus();
  }

  dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target.closest('[data-close-post]')||event.target===dialog)dialog.close();});
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.addEventListener('close',()=>{document.body.classList.remove('post-dialog-open');if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  return {
    async open(trigger){
      returnFocus=trigger;document.body.classList.add('post-dialog-open');
      dialog.innerHTML=`${head('SHARE WITH EVERYONE','Post your project')}<p class="post-help">Checking your account…</p>`;dialog.showModal();
      try{const user=await currentUser();if(dialog.open)user?renderComposer(user):renderAuth();}
      catch(error){dialog.innerHTML=`${head('SHARE WITH EVERYONE','Post your project')}<p class="post-status" data-kind="error">${escape(friendlyError(error))}</p>`;}
    },
  };
}
