import Link from "next/link";
import { FAQ_LINK_RE } from "@/lib/faq";

/**
 * Et FAQ-svar med inline-links.
 *
 * Svarene bliver skrevet i admin som ren tekst, og fire guider havde markdown-
 * links i dem, foer nogen opdagede at `{item.answer}` renderer dem bogstaveligt:
 * laeseren saa "[regnbukser](/bedste/regntoj)" paa siden. Redaktoeren forsoegte
 * fire gange uafhaengigt af hinanden, saa behovet er reelt, og det er billigere
 * at lade svaret baere links end at skrive linksyntaksen ud af fire tekster.
 *
 * Kun links, ikke fuld markdown. renderContent() er den fulde renderer, men den
 * er async, fordi den henter grejvarer til ::gear-inline, og et FAQ-svar er én
 * saetning med maaske ét link.
 */
export function FaqAnswer({ answer }: { answer: string }) {
  const dele: (string | JSX.Element)[] = [];
  let sidst = 0;
  const re = new RegExp(FAQ_LINK_RE.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(answer))) {
    if (m.index > sidst) dele.push(answer.slice(sidst, m.index));
    const [, label, href] = m;
    dele.push(
      href.startsWith("http") ? (
        <a
          key={dele.length}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {label}
        </a>
      ) : (
        <Link key={dele.length} href={href} className="text-accent hover:underline">
          {label}
        </Link>
      )
    );
    sidst = m.index + m[0].length;
  }
  if (sidst < answer.length) dele.push(answer.slice(sidst));

  return <>{dele}</>;
}
