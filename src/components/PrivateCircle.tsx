"use client";

import { useEffect, useRef } from "react";
import Icon from "./Icon";
import Link from "next/link";
import { requestCameraOnArrival } from "@/lib/share/camera";
import { STAGING_UPLOADS } from "@/lib/share/submission";

export type LiveLanguage = "EN" | "FR" | "PT";
export const circleCopy = {
  EN: {
    title: "The A PONTE Private Circle",
    steps: ["Share moments", "Build engagement", "Unlock benefits"],
    body: "Members who regularly share photos and take part in the A PONTE community may qualify for higher membership levels. Possible benefits include wine discounts, complimentary filming and editing for a member’s event, and press or TV exposure through A PONTE’s audiovisual network, including World Business Headsup.",
    note: "Levels, eligibility and benefits are still being finalised.",
    benefits: ["Wine discounts", "Event filming & editing", "Press features", "TV exposure"],
    ideas: ["Private tasting invitations", "Early access to new releases", "Invitations to A PONTE events"],
    share: "Share your moment", account: "Account", cameraTitle: "Your moment could be the beginning.",
    cameraBody: "Share a photo featuring your A PONTE bottle and discover the Private Circle. Members who take part regularly may qualify for future benefits.",
    take: "Let’s take a photo", choose: "Choose an existing photo",
  },
  FR: {
    title: "Le Cercle privé A PONTE",
    steps: ["Partager des moments", "Participer régulièrement", "Accéder aux avantages"],
    body: "Les membres qui partagent régulièrement des photos et participent à la communauté A PONTE pourront accéder à des niveaux supérieurs. Les avantages envisagés comprennent des réductions sur les vins, le tournage et le montage offerts pour un événement, et une visibilité dans la presse ou à la télévision via le réseau audiovisuel A PONTE, dont World Business Headsup.",
    note: "Les niveaux, les conditions d’accès et les avantages sont en cours de définition.",
    benefits: ["Réductions sur les vins", "Tournage et montage", "Articles de presse", "Visibilité à la télévision"],
    ideas: ["Dégustations privées", "Accès anticipé aux nouveautés", "Invitations aux événements A PONTE"],
    share: "Partagez votre moment", account: "Compte", cameraTitle: "Votre moment pourrait être un début.",
    cameraBody: "Partagez une photo avec votre bouteille A PONTE et découvrez le Cercle privé. Les membres qui participent régulièrement pourront accéder à de futurs avantages.",
    take: "Prendre une photo", choose: "Choisir une photo existante",
  },
  PT: {
    title: "O Círculo Privado A PONTE",
    steps: ["Partilhar momentos", "Participar regularmente", "Aceder a benefícios"],
    body: "Os membros que partilham fotografias regularmente e participam na comunidade A PONTE poderão aceder a níveis superiores. Os possíveis benefícios incluem descontos nos vinhos, filmagem e montagem gratuitas de um evento, e visibilidade na imprensa ou televisão através da rede audiovisual A PONTE, incluindo a World Business Headsup.",
    note: "Os níveis, as condições de acesso e os benefícios ainda estão a ser definidos.",
    benefits: ["Descontos nos vinhos", "Filmagem e montagem", "Destaque na imprensa", "Visibilidade na televisão"],
    ideas: ["Provas privadas", "Acesso antecipado a novidades", "Convites para eventos A PONTE"],
    share: "Partilhe o seu momento", account: "Conta", cameraTitle: "O seu momento pode ser o início.",
    cameraBody: "Partilhe uma fotografia com a sua garrafa A PONTE e descubra o Círculo Privado. Os membros que participam regularmente poderão ter acesso a benefícios futuros.",
    take: "Tirar uma fotografia", choose: "Escolher uma fotografia existente",
  },
};

export default function PrivateCircle({ language }: { language: LiveLanguage }) {
  const copy = circleCopy[language];
  const strip = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLUListElement>(null);
  const pauseUntil = useRef(0);
  useEffect(() => {
    const viewport = strip.current;
    const list = row.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!viewport || !list) return;
    let frame = 0;
    let previous = 0;
    let position = 0;
    let lastWritten = -1;
    const scroll = (now: number) => {
      const width = list.offsetWidth;
      if (now > pauseUntil.current && width && !viewport.matches(":focus-within")) {
        if (Math.abs(viewport.scrollLeft - lastWritten) > 1) position = viewport.scrollLeft;
        position -= Math.min(now - (previous || now), 50) * 0.023;
        if (position <= 0) position += width;
        if (position >= width * 2) position -= width;
        viewport.scrollLeft = position;
        lastWritten = viewport.scrollLeft;
      }
      previous = now;
      frame = requestAnimationFrame(scroll);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      previous = 0;
      viewport.scrollLeft = 0;
      if (!motion.matches) frame = requestAnimationFrame(scroll);
    };
    update();
    motion.addEventListener("change", update);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener("change", update); };
  }, [language]);
  const labels = STAGING_UPLOADS ? [...copy.benefits, ...copy.ideas] : copy.benefits;
  return <section className="private-circle" aria-labelledby="circle-heading">
    <h2 id="circle-heading">{copy.title}</h2>
    <ol className="circle-steps">{copy.steps.map((step, i) => <li key={step}><Icon name={["camera", "connection", "sparkle"][i]} size={25}/><span>{step}</span></li>)}</ol>
    <p>{copy.body}</p>
    <p className="circle-note">{copy.note}</p>
    <div ref={strip} className="circle-strip" role="region" aria-label={copy.steps[2]} tabIndex={0}
      onPointerDown={() => { pauseUntil.current = performance.now() + 5000; }}
      onPointerUp={() => { pauseUntil.current = performance.now() + 5000; }}
      onWheel={() => { pauseUntil.current = performance.now() + 5000; }}>
      {[0, 1, 2].map(i => <ul key={i} ref={i === 0 ? row : undefined} aria-hidden={i ? true : undefined}>{labels.map(label => <li key={label}>{label}</li>)}</ul>)}
    </div>
    <Link href="/live/share" onClick={requestCameraOnArrival} className="btn btn-white">{copy.share}</Link>
  </section>;
}
