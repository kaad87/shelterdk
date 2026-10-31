/**
 * ShelterDK-kategorien udledt af produktnavnet, naar intet andet kan sige den.
 *
 * Kategorien kom fra to kilder: feed-filteret (kun de filtrerede feeds) og den
 * manuelle kortlaegning i affiliate_category_mapping, som er noeglet paa
 * (retailer, category_raw). Maalt 26. oktober 2026 efterlod det 8.010 varer
 * uden kategori, heraf 72 af de 337 entries i udgivne guider.
 *
 * Problemet er, at kortlaegningen forudsaetter, at feedets egen kategori siger
 * noget. For tre slags gaar det ikke:
 *
 *   UBRUGELIG   outdoortid::"Populaere produkter" daekker 75 koebbare varer:
 *               telte, stole, hovedpuder, powerbanks, haandklaeder og
 *               foerstehjaelpssaet. Ti af de 72 entries hoerer her, fordelt
 *               paa syv guider. Ingen kortlaegning af det par kan vaere rigtig.
 *               Det samme gaelder outdoortid::"Mad" (stoebejernspander OG
 *               frysetoerret mad) og ::"Elektronik" (koeletaske OG lamper).
 *
 *   BRED        outmore::"Handsker" daekker 366 varer, hvoraf de foerste er
 *               Park Tool gummihandsker i aesker med 100 stk. og Shimano
 *               cykelhandsker. outmore::"Sko" daekker 567 og indeholder
 *               klatresko. outmore::"Hue" indeholder cykelkasketter.
 *
 *   FLERSTIET   backpackerlife skriver kategorien som en liste:
 *               "3 saesons soveposer > Gaveideer til boern > Soveposer >
 *               Soveposer til boern > Soveudstyr". Der er ingen enkelt gren at
 *               kortlaegge.
 *
 * Navnet er det eneste, der er til stede og praecist i alle tre tilfaelde.
 *
 * REGLERNE UDFYLDER KUN HULLER. I synken staar de SIDST:
 *   kat ?? mapping?.mapped ?? kategoriFraNavn(navn) ?? null
 * Et produkt der allerede har en kategori beholder den, saa hverken feedets
 * filter eller den manuelle kortlaegning kan blive overskrevet af et gaet. Det
 * er bevidst: en forkert regel kan tilfoeje stoej, men den kan ikke flytte en
 * vare, nogen har kortlagt med vilje.
 *
 * ÉN UNDTAGELSE: SIKRE NAVNE. Nogle navne er saa entydige, at de afgoer
 * kategorien uanset hvad feedets gren siger. "Tændstål", "FireSteel" og
 * "Vandtætte tændstikker" kan ikke vaere andet end optaending. De regler der
 * har et `sikker`-moenster laeses derfor FOER kortlaegningen:
 *   kat ?? sikkerKategoriFraNavn(navn) ?? mapping?.mapped ?? kategoriFraNavn(navn)
 *
 * Grunden er maalt 31. oktober 2026. Otte optaendings-varer laa spredt over
 * kogeudstyr, prepping og tilbehoer, fordi deres gren rummer alt andet:
 * outmore::"Brænder" (37 varer, 36 gasbraendere), outmore::"Tilbehør til
 * camping" (33 varer) og backpackerlife-stier paa op til ni grene paa én gang.
 * Fem af dem laa i kogeudstyr, som /bedste/bestik og /bedste/stormkoekken
 * henter deres tilbud fra, saa et ildstaal kunne staa som aktuelt tilbud i en
 * bestikguide. Fire kunne rettes i kortlaegningstabellen, fordi deres gren KUN
 * rummer optaending. De sidste fire kan tabellen ikke naa: en gren med 36
 * gasbraendere og ét ildstaal har kun ét rigtigt svar, og det er gasbraender.
 *
 * `sikker` er derfor snaevert og maalt: moensteret rammer 52 af 18.126
 * produktnavne, og alle 52 er optaending. De farlige navne staar udenfor med
 * vilje: "Camelbak Zephyr Pro - Flint Grey" (loebevest), "Merrell Speed
 * Strike" (vandresko), "Cebe Striker2" (skibriller), "Sea To Summit Spark"
 * (sovepose), "Firepot Chili Con Carne" (frysetoerret mad), "Petromax Fire
 * Skillet" (baalpande) og "Gentlemen's Hardware Campfire Chess" (et spil).
 * Derfor staar der `flint\s*wheel` og ikke `flint`, og
 * `fire\s*(?:steel|starter|...)` og ikke `fire`.
 *
 * ENGROS og `udeluk` gaelder ogsaa her: et sikkert navn paa en engrospakke
 * giver stadig ingen kategori. Omvendt gaelder ENGROS IKKE for
 * kortlaegningen, og det er med vilje: moensteret rammer "indbygget display"
 * paa 11 powerbanks og "Str. Pcs" paa 12 Edelrid-karabiner, saa som veto over
 * en bevidst kortlaegning ville det fjerne kategorien fra ~40 almindelige
 * varer.
 *
 * Boernevarer kategoriseres som alt andet. ALDRIG-vaernet i feed-filteret
 * handler om, hvad vi IMPORTERER; en boernesovepose er stadig en sovepose, og
 * /bedste/sovepose-til-boern har brug for at kunne finde den.
 */

/**
 * Engros og gavesaet, uanset kategori.
 *
 * Maalt i stikproeverne: "Park Tool Gummihandske Mg-3 L Box Med 100",
 * "PRO Flaske 50 stk Transp. 800ml 50pcs bulk box", "Light My Fire
 * Tinder-on-a-Rope, 50g bulk" og "Gift Republic Set Mug And Socks Fish". De
 * er ikke varer en guide kan anbefale.
 *
 * Bemaerk at der IKKE udelukkes paa "N stk": "Saebeblade - 50 stk" og "Dry bag
 * saet - 3 stk" er almindelige forbrugerpakker.
 */
export const ENGROS = /\bbulk\b|box\s*med\s*\d+|\bpcs\b|\bdisplay\b|\bkarton\b|gavesæt|gift\s*set|gift\s*republic/i;

interface NavneRegel {
  kategori: string;
  inkluder: RegExp;
  /** Ting der ligner, men ikke er. Proeves foerst. */
  udeluk?: RegExp;
  /**
   * Den del af `inkluder` der er saa entydig, at navnet afgoer kategorien
   * uanset hvad feedets gren siger. Laeses af sikkerKategoriFraNavn() FOER
   * kortlaegningen; se "ÉN UNDTAGELSE" oeverst. Skal vaere en delmaengde af
   * `inkluder`, saa de to funktioner ikke kan vaere uenige.
   */
  sikker?: RegExp;
}

/**
 * Raekkefoelgen afgoer. Den foerste regel der matcher vinder, saa det snaevre
 * staar foer det brede: pandelampe foer lygte, dunsovepose foer sovepose,
 * lagenpose foer sovepose.
 */
const REGLER: NavneRegel[] = [
  // ── Sove ──────────────────────────────────────────────────────────────────
  {
    kategori: "soveudstyr",
    // Lagenposen staar foerst, fordi "Cocoon Mummyliner" og "Travel Sheet" er
    // soveudstyr og ikke soveposer, men begge naevner tit "sleeping bag" i
    // beskrivelsen. Hovedpuden hoerer samme sted: sovepude-guiden daekker
    // begge.
    inkluder:
      /lagenpose|mummyliner|travel\s*sheet|sleeping\s*bag\s*liner|\bsovepude\b|hovedpude|rejsepude|\bpillow\b|oppustelig\s+(?:hovedpude|pude)|\bpude\b/i,
    udeluk: /stolehynde|siddepude|liggeunderlag/i,
  },
  {
    kategori: "sovepose",
    inkluder: /sovepose|soveposer|sleeping\s*bag|boernesovepose|børnesovepose/i,
    udeluk: /lagenpose|\bliner\b|pose\s*til\s*sovepose|kompressionspose/i,
  },
  {
    kategori: "liggeunderlag",
    inkluder:
      /liggeunderlag|sleeping\s*(?:pad|mat)|selvoppustelig|self.?inflating|\bisomat\b|luftmadras|air\s*mattress|\bthermarest\b/i,
    udeluk: /siddeunderlag|teltunderlag|footprint/i,
  },
  {
    kategori: "siddeunderlag",
    inkluder: /siddeunderlag|siddepude|sit\s*pad|seat\s*(?:pad|mat)|alu-?seat|sitzkissen/i,
  },

  // ── Ly ────────────────────────────────────────────────────────────────────
  {
    kategori: "telt",
    // "pavillon" stod her og trak festpavilloner og deres sidevaegge ind:
    // "Pavillon Easy Up - 3x4,5m" og "Sidevaeg til pavillon 3m bredde".
    // En partytelt-pavillon er ikke ly paa en sheltertur.
    inkluder:
      /\btelt\b|\btelte\b|\btents?\b|iglotelt|tunneltelt|tipi|\bbivi\b|bivvy|shelter\s*telt/i,
    // Pløkker, underlag og stænger er tilbehoer til et telt, ikke telte.
    udeluk:
      /teltunderlag|footprint|\bpløk\b|\bpløkker\b|\bpeg\b|\bpegs\b|teltstang|tent\s*pole|telttæppe|reparation|repair|bardun|guy\s*line|sidevæg|pavillon/i,
  },
  {
    kategori: "tarp",
    inkluder: /\btarp\b|\btarps\b|basha|regnslag\s*til\s*hængekøje/i,
  },
  {
    kategori: "haengekoje",
    inkluder: /hængekøje|haengekoje|\bhammock\b/i,
  },

  // ── Lys ───────────────────────────────────────────────────────────────────
  {
    kategori: "pandelampe",
    inkluder: /pandelampe|pandelamper|headlamp|head\s*torch|hovedlampe/i,
  },
  {
    kategori: "lygte",
    inkluder:
      /lanterne|\blantern\b|\blygte\b|lommelygte|flashlight|\btorch\b|arbejdslampe|\blampe\b|lyskæde|campinglampe|\blyskilde\b/i,
    // "Edelweiss Flashlight Ii 10mm60m - Reb" er et KLATREREB, hvis model
    // heder Flashlight, og den stod som `lygte`. Samme slags fejl som
    // fotohandsken "Hatchet" i oekse-reglen: modelnavnet er et andet produkt.
    udeluk: /cykellygte|bike\s*light|baglygte|forlygte|lampeolie|væge|lampefod|\breb\b|\brope\b|\bsling\b|prusik/i,
  },

  // ── Baal ──────────────────────────────────────────────────────────────────
  // Staar FOER kogeudstyr: en stoebejernspande til baal er baalgrej foerst og
  // koekkengrej bagefter, og uden den raekkefoelge havner halvdelen af
  // klyngen i kogeudstyr.
  //
  // Klyngen laa i outmores raa kategorier Båludstyr (78 varer paa lager),
  // Bålsted, Bålfad og Bålstativ, og INGEN af dem har en kortlaegningsraekke.
  // Alle 78 var derfor usynlige paa sitet. En ekstern SEO-audit kaldte
  // "bedste bålpande" en prioritet-1-mulighed, fordi SERP'en er svag, og
  // konkluderede samtidig, at vi ikke havde varerne. Vi havde dem; de havde
  // bare ingen kategori. Maalt 27. oktober 2026.
  {
    kategori: "baaludstyr",
    inkluder:
      /bålfad|bålsted|bålstativ|bålpande|bålgryde|bålrist|bålgaffel|bålskål|jægerpande|fire\s*pit|firepit|fire\s*bowl|fire\s*bridge|fire\s*anchor|campfire|dutch\s*oven|camp.?oven|støbejernspande|cast.?iron\s*(?:skillet|griddle|stack\s*grate|potato)|griddle\s*(?:plate|pan)|\bskillet\b|camp\s*grill|pack\s*grill|flatpack|grilliput|tri.?pod\s*grill|grillrist|snobrød|bread\s*skewer|bbq\s*skewer|camp\s*fork|telescoping\s*fork|kulskovl|coal\s*shovel|charcoal\s*(?:chimney|maker)|blow\s*pipe|fire\s*plunger/i,
    // Petromax saelger hele sit system som enkeltdele, saa klyngen er fuld af
    // reservedele. De navngiver nesten alle deres vaert paa engelsk ("Lid For
    // Pyron Fire Barrel", "Cooking Support for Atago", "Grate For Xl-sized
    // Flat Firepit"), og det moenster er den paalidelige graense mellem en
    // vare og en del til en vare. Kun engelsk "for": den danske pendant "til"
    // optraeder i varer vi VIL have, fx "grillrist til bål".
    //
    // deal-relevans har et beslaegtet erTilbehoer, men det er noeglet paa
    // danske "X til Y"-former og er valideret mod 182 historiske klik. Det
    // roeres ikke her for at undgaa at aendre tilbudsblokken i samme greb.
    // "Campfire" er desuden et PRODUKTLINJENAVN hos Primus, praecis som
    // "Hatchet" er en model af fotohandske: Primus Campfire Cookset, Cutlery
    // Set og Prep Set er kogegrej og bestik, ikke baalgrej.
    udeluk:
      // "Easy Camp Campfire Fire Steel - Taendstaal" er et taendstaal, og
      // taendstaal-reglen staar efter denne. Optaending er sin egen kategori.
      /\bfor\s+\w|primus\s*campfire|cookset|cutlery|prep\s*set|\bchess\b|\bgame\b|\bspil\b|fire\s*steel|firesteel|tændstål|\bflint\b|optænding|transport\s*bag|carry\s*bag|\bmat\b|\bpoker\b|potholders?|lashing|smoking\s*chips|char\s*cloth|heat\s*(?:reflector|diffuser|protector)|windbreak|flashing\s*kit|pizzasten|pizza\s*stone|lid\s*(?:holder|spacer)|pan\s*rack|extension\s*legs|universal\s*cross|pouring\s*aid|\btrivet\b|aramid/i,
  },

  // ── Koekken og mad ────────────────────────────────────────────────────────
  {
    kategori: "mad",
    inkluder:
      /frysetørret|frysetoerret|freeze.?dried|emergency\s*food|trek.?n\s*eat|expedition\s*meal|tørkost|\bmüsli\b|\bmysli\b|outdoor.?mad|\bnødration\b/i,
  },
  {
    kategori: "kogeudstyr",
    inkluder:
      /stormkøkken|stormkoekken|\btrangia\b|gasbrænder|gasblus|kogesæt|\bgryde\b|kasserolle|\bstegepande\b|støbejernspande|\bkedel\b|\bbestik\b|\bspork\b|bestiksæt|tallerken|emaljetallerken|\bskål\b|\bkrus\b|termokrus|termokop|\bfoldekop\b|\bkop\b|kaffetragt|stempelkande|espressokande|primus\s*lite/i,
    // "Trangia indsats til vindskaerm 27/25" er en reservedel.
    udeluk: /madkasse|opvaskebørste|vaskemiddel|indsats\s*til|vindskærm|\blåg\b|\bpakning\b/i,
  },
  {
    kategori: "vandfilter",
    inkluder:
      /vandfilter|water\s*filter|vandrensning|water\s*purif|lifestraw|\bkatadyn\b|\bsteripen\b|renseta?bletter/i,
    udeluk: /replacement|udskiftning|\bpatron\b|\bcarbon\s*filter\b/i,
  },
  {
    kategori: "drikkedunk",
    inkluder:
      // Hydrapak og Tatonka skriver dem uden "water": "Hydrapak Stash Bottle
      // 750 Ml", "Tatonka Faltkanister 5l".
      /drikkedunk|drikkeflaske|vandflaske|\bbottle\b|termoflaske|vacuum\s*bottle|vanddunk|kanister|væskeblære|hydration\s*(?:bladder|pack)|\bbidon\b/i,
    udeluk: /lommelærke|flaskeholder|\bmtb\b|bottle\s*cage/i,
  },
  {
    kategori: "taendstaal",
    inkluder:
      // UCO skriver dem paa engelsk: "UCO Hurricane Match Kit", "Hurricane
      // Survival Matches", "UCO Firestarting Kit".
      /tændstål|taendstaal|fire\s*steel|firesteel|ferro.?rod|tændstikker|tændblokke|optænding|optændings|firestart|\bmatches\b|match\s*kit|flint\s*(?:wheel|strike)|tinder/i,
    // "optænding" alene rammer to varer, hvor optaendingen er en BIVARE:
    // "Brænder - Esbit Emergency Stove - inkl. 3x14 g optændingstabletter" er
    // et braendersaet, og "Robens Paracord reb med optændingsmulighed" er et
    // reb. Begge laa som taendstaal og forurenede puljen bag /bedste/taendstaal.
    // Samme slags fejl som fotohandsken "Hatchet" i oekse-reglen.
    udeluk: /\bstove\b|paracord/i,
    // Maalt mod alle 18.126 produktnavne: 52 traef, alle optaending. Se
    // "ÉN UNDTAGELSE" oeverst for hvorfor moensteret er skrevet saa snaevert.
    // "ildstål" staar her, fordi outmore skriver "Gerber Fire Starter
    // praktisk ildstål" uden ordet taendstaal.
    sikker:
      /tændstål|taendstaal|ildstål|båltænding|fire\s*(?:steel|starter|starting|lighting)|ferro.?rod|flint\s*wheel|tændstikker|(?:stormproof|storm|waterproof|hurricane)\s*match|tinder\s*(?:sticks|-?quik|-?on-a-rope)/i,
  },

  // ── Baere ─────────────────────────────────────────────────────────────────
  {
    kategori: "taske",
    inkluder:
      /dry\s*bag|drybag|tørsæk|pakpose|pakkepose|stuff\s*sack|packsack|vandtæt\s*pose/i,
  },
  {
    kategori: "rygsaek",
    inkluder: /rygsæk|rygsaek|\bbackpack\b|\bdaypack\b|vandrerygsæk/i,
    // "Cargobag til rygsaek - Transportpose" og "Outdoor/shelter pakke -
    // Essentials - Inkl rygsaek" er tilbehoer og bundter, ikke rygsaekke.
    // "Tt Tac Pouch 10 - Rygsaek" er en lomme, og "Tatonka Raincover Bike
    // Daypack" er et regnslag til en taske.
    udeluk:
      /tilbehør\s*til\s*(?:rygsæk|task)|regnslag\s*til\s*rygsæk|rygsækbetræk|\btil\s*rygsæk\b|pakketilbud|inkl\.?\s*rygsæk|\bpouch\b|raincover|\bbetræk\b/i,
  },

  // ── Vaerktoej og navigation ───────────────────────────────────────────────
  {
    kategori: "oekse",
    inkluder: /\bøkse\b|\boekse\b|\baxe\b|\bhatchet\b|foldesav|håndsav|lommesav|\bsav\b|\bsaw\b/i,
    // "Vallerret Hatchet Leather Photography Glove" er en handske, hvis MODEL
    // heder Hatchet.
    udeluk:
      /sharpening|slibesten|\bfile\b|\bsheath\b|isøkse|ice\s*axe|photography|fotograf|\bglove\b|handske/i,
  },
  {
    kategori: "kniv",
    inkluder: /\bkniv\b|\bknive\b|\bknife\b|multitool|multiværktøj|foldekniv|dolk/i,
    // "Point Virgule Tjenerkniv/proptraekker I Rustfri Staal - Multitool" er
    // en vinaabner. Den stod som `kniv` og havnede derfor i tilbudsblokken paa
    // /bedste/kniv og paa /tilbud, hvor en ekstern SEO-audit faldt over den
    // 27. oktober 2026. Tre varianter af den, plus en cykellygte, var 4 af de
    // 40 varer paa /tilbud.
    udeluk: /\bkøkkenkniv\b|skærebræt|proptrækker|oplukker|vinåbner|korkskrue|tjenerkniv|\bwaiter/i,
  },
  {
    kategori: "navigation",
    // "Celestron CPC GPS XLT 800 - Kikkert" er et teleskop med GPS-montage.
    inkluder: /\bkompas\b|\bcompass\b|\bgps\b|kortmappe|kortlomme|\bkortholder\b/i,
    udeluk: /kikkert|teleskop|celestron|binocular/i,
  },
  {
    kategori: "kikkert",
    inkluder: /\bkikkert\b|\bkikkerter\b|binocular|monokular|\bteleskop\b/i,
    udeluk: /tilbehør|montage|montager|adapter|stativ|tripod|sigtekikkert|riffel|hand\s*control|okular/i,
  },
  {
    kategori: "vandrestav",
    inkluder: /vandrestav|vandrestave|trekking\s*pole|hiking\s*pole|\bstave\b/i,
    // "Trekking Pole Spare Basket" og "Rubber Tip Ferrule" er tilbehoer.
    udeluk:
      /\bdupper\b|tip\s*protector|spare\s*basket|\bferrule\b|\bkurv\b|tilbehør|skistav|skistave|ski\s*pole|teltstang/i,
  },

  // ── Beklaedning: snaevert foer bredt ──────────────────────────────────────
  {
    kategori: "gamacher",
    inkluder: /gamache|gamacher|\bgaiter\b|\bgaiters\b/i,
    // outmore::Gaiter rummer ogsaa cykelgamacher og skoovertraek:
    // "Vaude Bike Gaiter Short", "Vaude Shoecover Palade".
    // "Halsedisse - Smartwool Thermal Long Neck Gaiter" er halsbeklaedning.
    udeluk:
      /bike\s*gaiter|shoecover|skoovertræk|cykelgamache|halsedisse|neck\s*gaiter|\bhalsrør\b/i,
  },
  {
    kategori: "myggenet",
    inkluder: /myggenet|mosquito\s*(?:net|head|hat)|insektnet|\bbug\s*(?:net|jacket)\b/i,
  },
  {
    kategori: "regntoj",
    // "regnslag" stod i inkluder og trak "Tatonka Rain Flap" ind, som er et
    // regnslag TIL en rygsaek. Og "Littlelife Buggy Parasol" er til en
    // barnevogn.
    inkluder:
      /regntøj|regnjakke|regnbukser|regnsæt|\bponcho\b|rainwear|rain\s*(?:jacket|pants|coat)|skaljakke|skalbukser|hardshell|\bparaply\b|\bumbrella\b/i,
    udeluk:
      /regnslag\s*til|rygsækbetræk|rain\s*flap|\bbuggy\b|barnevogn|\bparasol\b/i,
  },
  {
    kategori: "handsker",
    inkluder: /\bhandske\b|\bhandsker\b|\bglove\b|\bgloves\b|\bluffer\b|\bvanter\b|\bmitten/i,
    // Maalt: outmore::Handsker rummer 366 varer, hvoraf de foerste er Park
    // Tool gummihandsker i aesker med 100 stk. og Shimano cykelhandsker.
    udeluk:
      /gummihandske|engangshandske|arbejdshandske|nitril|latex|cykelhandske|bike\s*glove|disposable|box\s*med|\bmg-?3\b|golfhandske|boksehandske|havehandske/i,
  },
  {
    kategori: "hue",
    // "buff" stod her, men det er et maerke: "Buff Baseball Cap UPF50+" blev
    // en hue i stedet for solbeskyttelse.
    inkluder: /\bhue\b|\bhuer\b|\bbeanie\b|pandebånd|\bheadband\b|balaclava|halsedisse|elefanthue|\bhalsrør\b/i,
    // "COAST LHS300 - lighted headband & safety light" er en pandelampe.
    // "Pandebaand til PETZL DUO og ULTRA" og "PETZL PIXA RUBBER headband" er
    // dele til en pandelampe.
    udeluk:
      /cykelhue|bike\s*(?:cap|warm\s*cap)|\bkasket\b|hjelmhue|safety\s*light|lighted|\bled\b|\bpetzl\b|til\s*pandelampe|\bbaseball\b/i,
  },
  {
    kategori: "dunjakke",
    inkluder: /dunjakke|dunvest|\bdown\s*(?:jacket|vest|hoody)\b|\bdunfrakke\b/i,
  },
  {
    kategori: "fleece",
    inkluder: /fleecetrøje|fleece\s*(?:jacket|hoody|sweater|pullover)|\bfleece\b/i,
    udeluk:
      /fleecehandske|fleecehue|fleece\s*(?:glove|hat|beanie|sock)|tæppe|blanket|thermarobe|badekåbe|\brobe\b/i,
  },
  {
    kategori: "sokker",
    inkluder: /\bsokker\b|\bsok\b|\bsocks?\b|strømper|vandresokker|hiking\s*sock|\bstrømpe\b/i,
    udeluk: /skistrømper|støttestrømper/i,
  },
  {
    kategori: "undertoj",
    inkluder:
      // "crew" stod i merino-alternativet og gjorde "Vallerret Merino Wool Crew
    // Sock" til undertoej. Sokker-reglen staar nu ogsaa foer denne.
    /uldundertøj|undertrøje|underbukser|uldunderbukser|base\s*layer|baselayer|long\s*(?:johns|janes)|netundertøj|\bmerino\b.*(?:trøje|bukser|zip\s*neck|turtle)/i,
  },
  {
    kategori: "solhat",
    inkluder: /\bsolhat\b|\bbøllehat\b|boonie\s*hat|sun\s*hat|bredskygget/i,
  },
  {
    kategori: "vandresandal",
    inkluder: /vandresandal|hiking\s*sandal|trekking\s*sandal|\bsandal\b|\bsandaler\b/i,
    udeluk: /badesandal|klipklap|flip.?flop/i,
  },
  {
    kategori: "vandrebukser",
    inkluder: /vandrebukser|hiking\s*(?:trousers|pants)|trekking\s*(?:trousers|pants)|zip.?off/i,
  },
  {
    kategori: "fodtoj",
    inkluder:
      /vandresko|vandrestøvle|vandrestøvler|hiking\s*(?:shoe|boot)|trekking\s*(?:shoe|boot)|\bstøvler\b|\bstøvle\b|\bboots?\b|\btrailsko\b/i,
    // "Grangers Rubber Boot Care 150 Ml." er plejemiddel og ikke fodtoej.
    udeluk:
      /gummistøvler|skistøvler|ski\s*boot|klatresko|climbing\s*shoe|hjemmesko|\bslipper\b|\bsandal\b|støvleskaft|indersål|boot\s*care|imprægner|\bpleje\b|\bvoks\b|skosnøre/i,
  },

  // ── Oevrigt ───────────────────────────────────────────────────────────────
  {
    kategori: "campingmobler",
    inkluder:
      /campingstol|foldestol|festivalstol|positionsstol|klapstol|\bstol\b|\bchair\b|campingbord|foldebord|\btaburet\b|campingseng|feltseng/i,
    udeluk: /stolehynde|stoleovertræk|barnestol/i,
  },
  {
    kategori: "elektronik",
    inkluder:
      /powerbank|power\s*bank|solcelleoplader|solcelle.*(?:oplader|powerbank)|nødradio|\boplader\b|\bcharger\b|rejseadapter/i,
    udeluk: /\bbatteri\b|\bbattery\b|opladerkabel/i,
  },
  {
    kategori: "hygiejne",
    // "vaskemiddel" stod her og trak Nikwax Tech-wash, Grangers Down Wash og
    // Grangers Merino Wash ind. Teknisk toejvask er plejemiddel til udstyr og
    // ikke personlig hygiejne, saa de faar ingen kategori.
    inkluder:
      /håndklæde|haandklaede|\btowel\b|microfiber.*håndklæde|brusepose|\bsæbe\b|\bsæbeblade\b|\bsoap\b|tandbørste|håndsprit|desinfektion|solcreme|læbepomade/i,
    udeluk: /tech.?wash|down\s*wash|merino\s*wash|imprægner|nikwax|grangers/i,
  },
  {
    kategori: "foerstehjaelp",
    inkluder:
      /førstehjælp|foerstehjaelp|first\s*aid|\bplaster\b|vabelplaster|\bblister\b|alutæppe|nødtæppe|emergency\s*blanket|nødfløjte/i,
  },
  {
    kategori: "prepping",
    inkluder: /nødpakke|overlevelsesudstyr|survival\s*kit|prepping/i,
  },
];

/**
 * Kategorien et produktnavn hoerer til, eller null naar ingen regel passer.
 *
 * Null er det normale svar. Reglerne daekker de emner, guiderne bruger, og
 * ikke hele kataloget: en cykelpumpe eller en kuffert skal ikke have en
 * ShelterDK-kategori, bare fordi den ligger i feedet.
 */
export function kategoriFraNavn(produktnavn: string): string | null {
  const navn = (produktnavn ?? "").trim();
  if (!navn) return null;
  if (ENGROS.test(navn)) return null;
  for (const r of REGLER) {
    if (r.udeluk?.test(navn)) continue;
    if (r.inkluder.test(navn)) return r.kategori;
  }
  return null;
}

/**
 * Kategorien et navn er SIKKER paa, eller null.
 *
 * Det her er det eneste sted, hvor navnet maa overskrive feedets egen
 * kortlaegning. Kun regler med et `sikker`-moenster svarer, og de staar i
 * samme raekkefoelge som REGLER, saa ENGROS og `udeluk` gaelder uaendret.
 *
 * Null er det normale svar: moensteret findes kun paa optaending, fordi det er
 * dér, grenene maaler sig til at vaere ubrugelige.
 */
export function sikkerKategoriFraNavn(produktnavn: string): string | null {
  const navn = (produktnavn ?? "").trim();
  if (!navn) return null;
  if (ENGROS.test(navn)) return null;
  for (const r of REGLER) {
    if (!r.sikker) continue;
    if (r.udeluk?.test(navn)) continue;
    if (r.sikker.test(navn)) return r.kategori;
  }
  return null;
}

/** Kategorierne reglerne kan give. Til tests og til whitelist-opslag. */
export function navneKategorier(): string[] {
  return [...new Set(REGLER.map((r) => r.kategori))];
}
