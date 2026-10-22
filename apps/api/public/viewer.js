import { parseGameInvitation, gameInvitationUrl, isLocalOnlyOrigin } from "/assets/invitation.js";
import { matchStandings, matchOutcome, matchDuration, formatDuration } from "/assets/results.js";
import { isArticleUrl } from "/assets/navigation.js";
import { boardConfigSummary } from "/assets/board-setup.js";
import { createServerClock, roundRemaining, roundTimerText, roundLimitLabel } from "/assets/round-timer.js";
import { readPresence, playerPresence } from "/assets/presence.js";
const clock=createServerClock();
let lastClockRefresh=-Infinity;
const $ = id => document.getElementById(id);
const parts = location.pathname.split('/').filter(Boolean);
const viewing = parts[0] === 'spectate' || parts[0] === 'overlay';
const overlay = parts[0] === 'overlay';
const joining = parts[0] === 'join';
const gameId = parts[1];
let selected = new URLSearchParams(location.search).get('playerId');
let current = null;
let socket = null;
let presence = null;
let lastSocketMessage = 0;
let retry = 0;
let disposed = false;
let inflight = null;
let again = false;
let selectionGeneration = 0;
let selectedSquare = null;

function connection(label, live = false) {
  $('connection').textContent = label; $('connection').classList.toggle('live',live);
  if (!live) { presence = null; renderPresence(); }
}
function notice(message, error = false) { $('notice').hidden = !message; $('notice').textContent = message; $('notice').classList.toggle('error',error); }
function element(tag, className, text) { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; }
function showArticle(squareId) {
  const evidence=current?.squareEvidence?.find(e=>e.squareId===squareId);
  if(!evidence)return;
  selectedSquare=squareId;
  $('article-objective').textContent=current.board.squares.find(s=>s.id===squareId)?.label ?? 'Scored square';
  $('article-scorer').textContent=`Earned by ${evidence.playerName}`;
  $('article-time').textContent=new Date(evidence.earnedAt).toLocaleString();
  const target=$('article-link');target.replaceChildren();
  if(evidence.url&&isArticleUrl(evidence.url)){
    const link=element('a','',evidence.title);link.href=evidence.url;link.target='_blank';link.rel='noopener noreferrer';target.append(link);
  }else target.append(element('span','',evidence.title),element('p','small','The original article link is unavailable.'));
  if(!$('article-dialog').open)$('article-dialog').showModal();
}
function renderTimer() {
  if(!current)return;
  $("round-timer").hidden=overlay&&!current.timeLimitSeconds;
  $("round-timer").textContent=roundTimerText(current,clock.now());
  $("round-timer").classList.toggle("time-up",roundRemaining(current,clock.now())===0||current.endReason==="TIME_LIMIT");
}
function renderPresence() {
  if (!current) return;
  const roster = $('connection-roster'); roster.replaceChildren();
  for (const player of current.players) {
    const status = playerPresence(player, presence);
    const chip = element('span','readiness-player'); chip.dataset.playerId = player.id;
    chip.append(element('span','',player.displayName),element('span',`player-presence ${status.status}`,status.label));
    roster.append(chip);
    const lobby = [...$('lobby-readiness').children].find(el => el.dataset.playerId === player.id);
    if (lobby) { lobby.querySelector('.player-presence')?.remove(); lobby.append(element('span',`player-presence ${status.status}`,status.label)); }
  }
  for (const card of $('scoreboard').children) {
    const members = current.players.filter(player => !player.leftAt && (current.mode === 'LOCKOUT' && player.teamId ? player.teamId === card.dataset.ownerId : player.id === card.dataset.ownerId));
    const badge = card.querySelector('.score-presence');
    const online = members.filter(player => playerPresence(player,presence).status === 'online').length;
    const reconnecting = members.filter(player => playerPresence(player,presence).status === 'reconnecting').length;
    const status = members.length === 1 ? playerPresence(members[0],presence) : { status: presence ? online ? 'online' : reconnecting ? 'reconnecting' : 'offline' : 'unknown', label: presence ? `${online}/${members.length} online${reconnecting ? ` · ${reconnecting} reconnecting` : ''}` : 'Connection unknown' };
    badge.textContent = members.length ? status.label : 'Left';
    badge.className = `score-presence player-presence ${members.length ? status.status : 'left'}`;
    card.title = `${card.dataset.ownerName} · ${badge.textContent}`;
  }
}
function render(state) {
  current=state;
  renderTimer();
  $('board-settings').textContent=boardConfigSummary(state.boardConfig);
  $('joining-access').hidden=state.status==='FINISHED';
  $('joining-access').textContent=state.isJoinLocked?'Joining locked · Existing players can reconnect.':'Joining open · New players can use the invitation.';
  $('previous-round').hidden=!state.previousGameId;
  $('next-round').hidden=!state.rematchGameId;
  if(state.previousGameId)$('previous-round').href=`/spectate/${encodeURIComponent(state.previousGameId)}`;
  if(state.rematchGameId)$('next-round').href=`/spectate/${encodeURIComponent(state.rematchGameId)}`;
  $('match-title').textContent=state.status==='WAITING'?'The race starts here.':state.status==='FINISHED'?'That’s a wrap.':'Every article counts.';
  $('mode-label').textContent=`${state.mode==='LOCKOUT'?'LOCKOUT · 13 SQUARES TO WIN':'NORMAL · FIRST BINGO WINS'}`;
  const finished=state.status==='FINISHED';
  const lobbyPlayers=state.players.filter(player=>!player.leftAt);
  const readyCount=lobbyPlayers.filter(player=>player.isReady).length;
  const duration=state.startedAt||state.endReason==='LEGACY_UNKNOWN'?`Match duration · ${formatDuration(matchDuration(state))}`:'Match did not start';
  $('match-subtitle').textContent=`${finished?`${state.players.length} participants`:`${state.playerCount} playing`} · Game ${state.gameId.slice(0,8)} · ${state.status==='WAITING'?`Waiting for the host${state.isJoinLocked?' · Joining locked':''}`:finished?duration:`In progress${state.isJoinLocked?' · Joining locked':''}`}`;
  $('match-results').hidden=!finished;
  if(finished){
    $('results-title').textContent=matchOutcome(state);
    $('results-duration').textContent=duration;
    $('results-note').textContent=state.mode==='NORMAL'?'First bingo wins. Other places are ordered by completed squares; equal scores share a place.':'13 squares wins. Team claims count together; equal scores share a place.';
  }
  const follow=$('follow-player');
  $('follow-label').hidden=state.mode!=='NORMAL'; follow.hidden=state.mode!=='NORMAL';
  const oldValue=follow.value;
  follow.replaceChildren(...state.players.map(player=>{const option=element('option','',player.displayName+(player.removedByHost?' (removed)':player.leftAt?' (left)':''));option.value=player.id;return option;}));
  follow.value=state.playerId ?? oldValue;
  if(state.winner) notice(`${state.winningOwner.name} won ${state.mode==='LOCKOUT'?'by majority':'by bingo'}!`);
  else if(state.status==='FINISHED') notice(state.endReason==='TIME_LIMIT'?'Time’s up. Final scores are below; no winner was declared.':state.endReason==='BOARD_EXHAUSTED'?'Draw! The board is full and no owner reached 13 squares.':state.endReason==='LEGACY_UNKNOWN'?'This older match has no recorded final winner.':state.endReason==='EMPTY'?'Everyone has left this match.':'The host ended the match. No winner was declared.');
  else if(state.status==='WAITING') notice(`${readyCount}/${lobbyPlayers.length} ready. ${readyCount===lobbyPlayers.length&&lobbyPlayers.length?'Everyone is ready. Waiting for the host to start.':'Players mark Ready in the extension before the host can start.'}`);
  else notice('');
  $('lobby-readiness').hidden=state.status!=='WAITING';
  $('lobby-readiness').replaceChildren(...lobbyPlayers.map(player=>{const chip=element('span',`readiness-player${player.isReady?' ready':''}`,`${player.displayName}${player.isHost?' · host':''} · ${player.isReady?'Ready':'Not Ready'}`);chip.dataset.playerId=player.id;return chip;}));
  const ranked=matchStandings(state);
  const visible=overlay?ranked.slice(0,32):ranked;
  const followed=ranked.find(score=>score.id===state.playerId);
  if(overlay&&followed&&!visible.includes(followed))visible[visible.length-1]=followed;
  document.body.classList.toggle('dense-roster',overlay&&visible.length>8);
  $('overlay-summary').hidden=!overlay||ranked.length<=visible.length;
  $('overlay-summary').textContent=`Showing ${visible.length} of ${ranked.length} scores, including the followed player. Full roster in spectator view.`;
  const scoreboard=$('scoreboard'); scoreboard.replaceChildren();
  for(const score of visible) {
    const card=element('div','score-card'+(score.id===state.playerId?' selected':''));card.title=score.name;
    card.dataset.ownerId=score.id; card.dataset.ownerName=score.name;
    const swatch=element('span','score-swatch');swatch.style.backgroundColor=score.color || '#4c7860';
    const members=lobbyPlayers.filter(player=>state.mode==='LOCKOUT'&&player.teamId?player.teamId===score.id:player.id===score.id);
    const detail=state.status==='WAITING'&&members.length?`${members.filter(player=>player.isReady).length}/${members.length} ready`:score.isWinner?'Winner':score.detail;
    const label=element('div');label.append(element('div','score-name',`${finished?`${score.rank}. `:''}${score.name}`),element('div','score-detail',detail),element('div','score-presence'));
    card.append(swatch,label,element('span','score-number',String(score.score)));scoreboard.append(card);
  }
  renderPresence();
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
    if(!overlay&&state.squareEvidence?.some(e=>e.squareId===square.id)){
      const button=element('button','evidence-button','View article');button.setAttribute('aria-label',`View article for ${square.label}`);
      button.addEventListener('click',()=>showArticle(square.id));tile.append(button);
    }
    board.append(tile);
  }
  const evidence=state.squareEvidence ?? [];
  $('history-count').textContent=`Scored articles · ${evidence.length} ${evidence.length===1?'square':'squares'}`;
  $('history-hint').textContent=evidence.length?(state.mode==='NORMAL'?`Articles that earned ${state.playerName ?? 'this player'}’s squares.`:'The original article and player behind each claim.'):'Articles appear here when they earn a square.';
  const historyList=$('history-list');historyList.replaceChildren();
  if(!overlay)for(const item of evidence){
    const row=element('li');row.append(element('span','history-objective',state.board.squares.find(s=>s.id===item.squareId)?.label ?? 'Scored square'));
    const button=element('button','history-article',item.title);button.addEventListener('click',()=>showArticle(item.squareId));row.append(button);historyList.append(row);
  }
  if($('article-dialog').open){if(evidence.some(e=>e.squareId===selectedSquare))showArticle(selectedSquare);else $('article-dialog').close();}
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
      if(version===selectionGeneration){clock.sync(Number(response.headers.get("X-WikiRace-Time")));render(data);connection(socket?.readyState===WebSocket.OPEN?'Live match':'Connected · reconnecting live updates',true);}
      else again=true;
    } while(again&&!disposed);
  })().catch(error=>{connection('Connection interrupted');notice(error.message || 'Cannot reach the server. Retrying…',true);if(!current)$('match-title').textContent='This game is unavailable.';}).finally(()=>{inflight=null;});
  return inflight;
}
function connect() {
  if(disposed)return;
  const next=new WebSocket(`${location.origin.replace(/^http/,'ws')}/ws/${encodeURIComponent(gameId)}`); socket=next;
  lastSocketMessage=performance.now();
  next.onopen=()=>{if(socket!==next)return;retry=0;connection('Live match',true);void refresh();};
  next.onmessage=event=>{
    if(socket!==next)return;
    lastSocketMessage=performance.now();
    try {
      const message=JSON.parse(event.data);
      if(message.type==='GAME_STATE_UPDATED')void refresh();
      if(message.type==='CONNECTED'&&message.capabilities?.includes('player-presence-v1'))next.send(JSON.stringify({type:'WATCH_PRESENCE'}));
      const update=readPresence(message,gameId);if(update){presence=update;renderPresence();}
    }catch{/* Ignore malformed notifications; fetch remains authoritative. */}
  };
  next.onerror=()=>next.close();
  next.onclose=()=>{if(socket!==next)return;connection('Reconnecting…');if(!disposed)setTimeout(connect,Math.min(15000,500*2**Math.min(retry++,5)));};
}
async function copy(path) {
  const query=selected?`?playerId=${encodeURIComponent(selected)}`:'';
  try{await navigator.clipboard.writeText(`${location.origin}/${path}/${gameId}${query}`);notice(path==='overlay'?'OBS browser-source URL copied. Use a 1280 × 900 browser source.':'Spectator link copied.');}
  catch{const field=$('copy-fallback');field.value=`${location.origin}/${path}/${gameId}${query}`;field.hidden=false;field.select();notice('Clipboard access is unavailable. Copy the selected link.',true);}
}
if(viewing){
  document.body.classList.toggle('overlay',overlay);
  document.documentElement.classList.toggle('overlay-root',overlay);
  $('viewer').hidden=false;
  $('follow-player').addEventListener('change',event=>{$('article-dialog').close();selected=event.target.value;selectionGeneration++;history.replaceState(null,'',`${location.pathname}?playerId=${encodeURIComponent(selected)}`);void refresh();});
  $('close-article').addEventListener('click',()=>$('article-dialog').close());
  $('article-dialog').addEventListener('close',()=>{selectedSquare=null;});
  $('copy-link').addEventListener('click',()=>void copy('spectate'));
  $('copy-overlay').addEventListener('click',()=>void copy('overlay'));
  void refresh(); connect();
  const clockTicker=setInterval(()=>{renderTimer();if(socket?.readyState===WebSocket.OPEN&&performance.now()-lastSocketMessage>45000){connection('Reconnecting…');socket.close();}if(roundRemaining(current??{},clock.now())===0&&performance.now()-lastClockRefresh>=3000){lastClockRefresh=performance.now();void refresh();}},250);
  addEventListener("pagehide",()=>clearInterval(clockTicker));
  const fallback=setInterval(()=>void refresh(),15000);
  addEventListener('pagehide',()=>{disposed=true;clearInterval(fallback);socket?.close();});
}else{
  $('home').hidden=false;$('server-origin').textContent=location.origin;
  fetch('/ready',{signal:AbortSignal.timeout(5000)}).then(response=>{if(!response.ok)throw new Error();connection('Server ready',true);}).catch(()=>connection('Database unavailable'));
  $('connection-hint').textContent=isLocalOnlyOrigin(location.origin)?'This address works on this computer. Players on other computers need the host’s trusted-network address.':'Players must be able to reach this server address. A shared link does not configure their network.';
  $('watch-form').addEventListener('submit',event=>{
    event.preventDefault();
    try {const target=parseGameInvitation($('game-id').value,location.origin);location.assign(`${target.apiOrigin}/spectate/${target.gameId}`);}
    catch(error){$('form-error').textContent=error.message;}
  });
  if(joining){
    $('invitation').hidden=false;$('home-hero').hidden=true;$('copy-invitation').disabled=true;
    (async()=>{
      try{
        const target=parseGameInvitation(location.href,location.origin);const url=gameInvitationUrl(target.apiOrigin,target.gameId);$('invite-url').value=url;$('invite-watch').href=`/spectate/${target.gameId}`;
        const response=await fetch(`/games/${target.gameId}/spectator`,{signal:AbortSignal.timeout(10000)});const state=await response.json();if(!response.ok)throw new Error(state.error || 'This invitation is unavailable.');
        $('invite-title').textContent=state.status==='FINISHED'?'This match has finished.':state.isJoinLocked?'Joining is locked.':'Join the race.';
        $('invite-details').textContent=`${state.mode==='LOCKOUT'?'Lockout · 13 squares to win':'Normal · first bingo wins'} · ${state.playerCount} playing · ${state.status==='WAITING'?'Waiting in lobby':state.status==='ACTIVE'?'Match in progress':'Ask the host for a new invitation.'}`;
        $('invite-board-settings').textContent=boardConfigSummary(state.boardConfig);
        $('invite-timer').textContent=roundLimitLabel(state.timeLimitSeconds);
        if(state.isJoinLocked&&state.status!=='FINISHED')$('invite-details').textContent='The host has locked new arrivals. Ask them to reopen joining. Existing players can reconnect in their extension.';
        $('copy-invitation').disabled=state.status==='FINISHED'||state.isJoinLocked;
      }catch(error){$('invite-title').textContent='This invitation is unavailable.';$('invite-details').textContent=error.message;}
    })();
    $('copy-invitation').addEventListener('click',async()=>{
      try{await navigator.clipboard.writeText($('invite-url').value);$('invite-feedback').textContent='Invitation copied. Paste it into Join Game in the extension.';}
      catch{$('invite-url').select();$('invite-feedback').textContent='Copy the selected invitation, then paste it into Join Game in the extension.';}
    });
  }
}
