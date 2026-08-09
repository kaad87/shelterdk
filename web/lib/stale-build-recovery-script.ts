/**
 * Inline-script der genindlæser siden når dens JS-chunks ikke findes længere.
 *
 * Ligger som en delt streng, så root-layoutet og testen bruger præcis den samme
 * kode — et inline-script i JSX kan ellers ikke testes.
 *
 * Se den fyldige forklaring i `app/layout.tsx`, hvor det indsættes. Kort:
 * chunk-navne har indholds-hash, deploys fjerner de gamle, og en genskabt
 * iOS-fane fra før et deploy henter derfor en chunk der er væk. En React-lytter
 * duer ikke — den registreres i `useEffect`, som aldrig kører når hydreringen
 * fejler, hvilket er præcis hvad der sker i det tilfælde.
 *
 * Nøglen skal matche `STALE_BUILD_GUARD_KEY`.
 */
export const STALE_BUILD_GUARD_KEY = "shelterdk:stale-build-reloaded";

export const STALE_BUILD_RECOVERY_SCRIPT =
  `(function(){var K='${STALE_BUILD_GUARD_KEY}';` +
  `window.addEventListener('error',function(e){` +
  `var el=e.target;if(!el||el.tagName!=='SCRIPT')return;` +
  `var s=el.src||'';if(s.indexOf('/_next/static/')<0)return;` +
  `try{if(sessionStorage.getItem(K))return;sessionStorage.setItem(K,'1');}catch(_){return;}` +
  `location.reload();},true);})();`;
