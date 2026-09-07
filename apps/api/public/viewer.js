const $ = id => document.getElementById(id);
const parts = location.pathname.split('/').filter(Boolean);
const viewing = parts[0] === 'spectate' || parts[0] === 'overlay';
const overlay = parts[0] === 'overlay';
const gameId = parts[1];
let selected = new URLSearchParams(location.search).get('playerId');
let current = null;
let socket = null;
let retry = 0;
let disposed = false;
let inflight = null;
let again = false;
let selectionGeneration = 0;

function connection(label, live = false) { $('connection').textContent = label; $('connection').classList.toggle('live',live); }
function notice(message, error = false) { $('notice').hidden = !message; $('notice').textContent = message; $('notice').classList.toggle('error',error); }
function element(tag, className, text) { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; }
function scores(state) {
  if(state.mode==='NORMAL') return state.players.map(p=>({id:p.id,name:p.displayName,color:p.color,score:p.score,detail:p.leftAt?'Left match':p.isHost?'Host':'Player'}));
  const teams=state.teams.map(t=>({id:t.id,name:t.name,color:t.color,score:state.squareClaims.filter(c=>c.teamId===t.id).length,detail:`Team · ${t.players.length} playing`}));
  const players=state.players.filter(p=>!p.teamId).map(p=>({id:p.id,name:p.displayName,color:p.color,score:state.squareClaims.filter(c=>c.playerId===p.id).length,detail:p.leftAt?'Left match':'Solo player'}));
  return [...teams,...players];
}
function render(state) {
  current=state;
  $('match-title').textContent=state.status==='WAITING'?'The race starts here.':state.status==='FINISHED'?'That’s a wrap.':'Every article counts.';
  $('mode-label').textContent=`${state.mode==='LOCKOUT'?'LOCKOUT · 13 SQUARES TO WIN':'NORMAL · FIRST BINGO WINS'}`;
  $('match-subtitle').textContent=`${state.playerCount} playing · Game ${state.gameId.slice(0,8)} · ${state.status==='WAITING'?'Waiting for the host':state.status==='FINISHED'?'Finished':'In progress'}`;
  const follow=$('follow-player');
  $('follow-label').hidden=state.mode!=='NORMAL'; follow.hidden=state.mode!=='NORMAL';
  const oldValue=follow.value;
  follow.replaceChildren(...state.players.map(player=>{const option=element('option','',player.displayName+(player.leftAt?' (left)':''));option.value=player.id;return option;}));
  follow.value=state.playerId ?? oldValue;
  if(state.winner) notice(`${state.winningOwner.name} won ${state.mode==='LOCKOUT'?'by majority':'by bingo'}!`);
  else if(state.status==='FINISHED') notice(state.endReason==='BOARD_EXHAUSTED'?'Draw! The board is full and no owner reached 13 squares.':state.endReason==='LEGACY_UNKNOWN'?'This older match has no recorded final winner.':state.endReason==='EMPTY'?'Everyone has left this match.':'The host ended the match. No winner was declared.');
  else if(state.status==='WAITING') notice('The lobby is open. Players choose their teams before the host starts.');
  else notice('');
  const scoreboard=$('scoreboard'); scoreboard.replaceChildren();
  for(const score of scores(state).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name))) {
    const card=element('div','score-card'+(score.id===state.playerId?' selected':''));
    const swatch=element('span','score-swatch');swatch.style.backgroundColor=score.color || '#4c7860';
    const label=element('div');label.append(element('div','score-name',score.name),element('div','score-detail',score.detail));
    card.append(swatch,label,element('span','score-number',String(score.score)));scoreboard.append(card);
  }
  const completed=new Set(state.completedSquareIds);
  const winning=new Set(state.mode==='NORMAL'&&state.winningOwner?.id===state.playerId?state.winningLine ?? []:[]);
  const claims=new Map(state.squareClaims.map(claim=>[claim.squareId,claim]));
  const board=$('board');board.replaceChildren();
  for(const square of [...state.board.squares].sort((a,b)=>a.position-b.position)) {
    const tile=element('div','tile'+(completed.has(square.id)?' completed':'')+(winning.has(square.position)?' winning':''));
    tile.setAttribute('role','listitem');
    tile.append(element('span','tile-number',String(square.position+1).padStart(2,'0')),element('span','tile-label',square.label));
    const claim=claims.get(square.id);
    if(claim){tile.style.backgroundColor=claim.teamColor || claim.playerColor || '';tile.append(element('span','tile-owner',claim.teamName || claim.playerName));}
    else if(completed.has(square.id)) tile.append(element('span','tile-owner','Completed'));
    board.append(tile);
  }
  $('view-note').textContent=state.mode==='NORMAL'?`Following ${state.playerName ?? 'a player'} · Read-only spectator view · Updates appear automatically.`:'Read-only spectator view · First claims are permanent · Updates appear automatically.';
}
async function refresh() {
  if(disposed)return;
  if(inflight){again=true;return inflight;}
  inflight=(async()=>{
    do {
      again=false;
      const version=selectionGeneration;
      const query=selected?`?playerId=${encodeURIComponent(selected)}`:'';
      const response=await fetch(`/games/${encodeURIComponent(gameId)}/spectator${query}`,{signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Unable to load this game.');
      if(version===selectionGeneration){render(data);connection(socket?.readyState===WebSocket.OPEN?'Live match':'Connected · reconnecting live updates',true);}
      else again=true;
    } while(again&&!disposed);
  })().catch(error=>{connection('Connection interrupted');notice(error.message || 'Cannot reach the server. Retrying…',true);if(!current)$('match-title').textContent='This game is unavailable.';}).finally(()=>{inflight=null;});
  return inflight;
}
function connect() {
  if(disposed)return;
  socket=new WebSocket(`${location.origin.replace(/^http/,'ws')}/ws/${encodeURIComponent(gameId)}`);
  socket.onopen=()=>{retry=0;connection('Live match',true);void refresh();};
  socket.onmessage=event=>{try{if(JSON.parse(event.data).type==='GAME_STATE_UPDATED')void refresh();}catch{/* Ignore malformed notifications; fetch remains authoritative. */}};
  socket.onerror=()=>socket.close();
  socket.onclose=()=>{connection('Reconnecting…');if(!disposed)setTimeout(connect,Math.min(15000,500*2**Math.min(retry++,5)));};
}
async function copy(path) {
  const query=selected?`?playerId=${encodeURIComponent(selected)}`:'';
  try{await navigator.clipboard.writeText(`${location.origin}/${path}/${gameId}${query}`);notice(path==='overlay'?'OBS browser-source URL copied. Use a 1280 × 900 browser source.':'Spectator link copied.');}
  catch{notice('Clipboard access is unavailable. Copy the URL from the address bar.',true);}
}
if(viewing){
  document.body.classList.toggle('overlay',overlay);
  document.documentElement.classList.toggle('overlay-root',overlay);
  $('viewer').hidden=false;
  $('follow-player').addEventListener('change',event=>{selected=event.target.value;selectionGeneration++;history.replaceState(null,'',`${location.pathname}?playerId=${encodeURIComponent(selected)}`);void refresh();});
  $('copy-link').addEventListener('click',()=>void copy('spectate'));
  $('copy-overlay').addEventListener('click',()=>void copy('overlay'));
  void refresh(); connect();
  const fallback=setInterval(()=>void refresh(),15000);
  addEventListener('pagehide',()=>{disposed=true;clearInterval(fallback);socket?.close();});
}else{
  $('home').hidden=false;$('server-origin').textContent=location.origin;
  fetch('/ready',{signal:AbortSignal.timeout(5000)}).then(response=>{if(!response.ok)throw new Error();connection('Server ready',true);}).catch(()=>connection('Database unavailable'));
  $('watch-form').addEventListener('submit',event=>{event.preventDefault();let id=$('game-id').value.trim();try{if(id.includes('://'))id=new URL(id).pathname.split('/').filter(Boolean).at(-1);}catch{/* Validation below handles invalid input. */}if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){$('form-error').textContent='Enter the complete game ID from the host.';return;}location.assign(`/spectate/${id}`);});
}
