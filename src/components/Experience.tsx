"use client";

import Link from "next/link";
import { type ReactNode, type FormEvent, type PointerEvent, useEffect, useRef, useState } from "react";

type Screen = "live" | "moments" | "share";
// Share flow: review the photo, optional free-bottle invitation, thank-you.
type ShareStage = "review" | "email" | "thankYou";
type Language = "EN" | "FR" | "PT";
// The A PONTE markets, in the institutional site's order (src/data/countries.ts), as
// ISO 3166-1 alpha-2 codes. Any other country code is grouped under "Other".
const MARKETS = ["PT", "CA", "CM", "TD", "GA", "GQ", "CF", "CD", "CG"] as const;
type Market = (typeof MARKETS)[number];
type CountryFilter = "all" | Market | "other";
const COUNTRY_FILTERS: CountryFilter[] = ["all", ...MARKETS, "other"];
const FILTER_LABELS: Record<CountryFilter, Record<Language, string>> = {
  all: { EN: "All", FR: "Tous", PT: "Todos" },
  PT: { EN: "Portugal", FR: "Portugal", PT: "Portugal" },
  CA: { EN: "Canada", FR: "Canada", PT: "Canadá" },
  CM: { EN: "Cameroon", FR: "Cameroun", PT: "Camarões" },
  TD: { EN: "Chad", FR: "Tchad", PT: "Chade" },
  GA: { EN: "Gabon", FR: "Gabon", PT: "Gabão" },
  GQ: { EN: "Equatorial Guinea", FR: "Guinée équatoriale", PT: "Guiné Equatorial" },
  CF: { EN: "Central African Republic", FR: "Centrafrique", PT: "República Centro-Africana" },
  CD: { EN: "DR Congo", FR: "RD Congo", PT: "RD Congo" },
  CG: { EN: "Republic of the Congo", FR: "République du Congo", PT: "República do Congo" },
  other: { EN: "Other", FR: "Autres", PT: "Outros" },
};
const isMarket = (code: string): code is Market => (MARKETS as readonly string[]).includes(code);
function matchesFilter(countryCode: string, filter: CountryFilter) {
  if (filter === "all") return true;
  if (filter === "other") return !isMarket(countryCode);
  return countryCode === filter;
}

type Moment = {
  id: number;
  title: string;
  author: string;
  city: string;
  // Filtering uses the code; the name is what the moment displays (e.g. "BR" / "Brazil" lands in Other).
  countryCode: string;
  country: string;
  image: string;
  height: "short" | "medium" | "tall";
  note: string;
};

const COMPANY_URL = "https://pontelusocan.com/";
// Files in public/ live under the GitHub Pages project path when built for it (next.config.ts).
const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH}${path}`;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Same order, labels and flag-icons classes as the institutional site's Navbar.tsx.
const LANGUAGES: { code: Language; label: string; flagClass: string }[] = [
  { code: "FR", label: "Français", flagClass: "fi-fr" },
  { code: "EN", label: "English", flagClass: "fi-gb" },
  { code: "PT", label: "Português", flagClass: "fi-pt" },
];
// Stands in for the photo the visitor has just taken (frontend demo: no camera, no upload).
const CAPTURED_PHOTO = asset("/brand/image-2.png");
const PHOTO = (id: string, width = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

// Editorial, illustrative imagery — not actual A PONTE submissions. Replace before launch.
const MOMENTS: Moment[] = [
  { id: 1, title: "An evening to remember", author: "Sofia M.", city: "Lisbon", countryCode: "PT", country: "Portugal", image: PHOTO("photo-1510812431401-41d2bd2722f3", 650), height: "tall", note: "The best conversations happen around a shared table." },
  { id: 2, title: "Across the table", author: "Marc D.", city: "Montréal", countryCode: "CA", country: "Canada", image: PHOTO("photo-1414235077428-338989a2e8c0", 650), height: "medium", note: "Some evenings stay with us long after the last glass." },
  { id: 3, title: "Golden hour", author: "Inês R.", city: "Porto", countryCode: "PT", country: "Portugal", image: PHOTO("photo-1506377247377-2a5b3b417ebb", 650), height: "medium", note: "A little sunshine. A lovely wine. The right people." },
  { id: 4, title: "A special celebration", author: "Claire N.", city: "Douala", countryCode: "CM", country: "Cameroon", image: PHOTO("photo-1511795409834-ef04bbd61622", 650), height: "tall", note: "An occasion worth remembering, with people worth celebrating." },
  { id: 5, title: "The art of gathering", author: "Daniel T.", city: "Toronto", countryCode: "CA", country: "Canada", image: PHOTO("photo-1528823872057-9c018a7a7553", 650), height: "tall", note: "Good company has no borders." },
  { id: 6, title: "A toast to friendship", author: "Émilie K.", city: "Yaoundé", countryCode: "CM", country: "Cameroon", image: PHOTO("photo-1528605248644-14dd04022da1", 650), height: "medium", note: "A little moment, a big memory." },
  { id: 7, title: "Sunday, slowly", author: "Joana F.", city: "Cascais", countryCode: "PT", country: "Portugal", image: PHOTO("photo-1498804103079-a6351b050096", 650), height: "short", note: "Slow afternoons and stories that linger." },
  { id: 8, title: "Together again", author: "Alex B.", city: "Ottawa", countryCode: "CA", country: "Canada", image: PHOTO("photo-1519167758481-83f550bb49b3", 650), height: "medium", note: "Distance changes. Friendship doesn't." },
  { id: 9, title: "A night of discovery", author: "Nadine E.", city: "Douala", countryCode: "CM", country: "Cameroon", image: PHOTO("photo-1531058020387-3be344556be6", 650), height: "medium", note: "A shared discovery, a new tradition." },
];

// Community carousel: Portugal and Canada, then Cameroon and the other African
// markets from the institutional site (src/data/countries.ts), in its order and
// with its country names. Illustrative Wikimedia Commons city photographs,
// not customer submissions — credits in public/cities/CREDITS.md.
const place = (en: string, fr = en, pt = en): Record<Language, string> => ({ EN: en, FR: fr, PT: pt });
const CITIES: { slug: string; city: Record<Language, string>; country: Record<Language, string> }[] = [
  { slug: "lisbon", city: place("Lisbon", "Lisbonne", "Lisboa"), country: place("PORTUGAL") },
  { slug: "porto", city: place("Porto"), country: place("PORTUGAL") },
  { slug: "montreal", city: place("Montréal"), country: place("CANADA", "CANADA", "CANADÁ") },
  { slug: "quebec-city", city: place("Québec City", "Québec", "Cidade do Quebeque"), country: place("CANADA", "CANADA", "CANADÁ") },
  { slug: "douala", city: place("Douala"), country: place("CAMEROON", "CAMEROUN", "CAMARÕES") },
  { slug: "yaounde", city: place("Yaoundé"), country: place("CAMEROON", "CAMEROUN", "CAMARÕES") },
  { slug: "ndjamena", city: place("N’Djamena"), country: place("CHAD", "TCHAD", "CHADE") },
  { slug: "libreville", city: place("Libreville"), country: place("GABON", "GABON", "GABÃO") },
  { slug: "malabo", city: place("Malabo"), country: place("EQUATORIAL GUINEA", "GUINÉE ÉQUATORIALE", "GUINÉ EQUATORIAL") },
  { slug: "bangui", city: place("Bangui"), country: place("CENTRAL AFRICAN REPUBLIC", "RÉPUBLIQUE CENTRAFRICAINE", "REPÚBLICA CENTRO-AFRICANA") },
  { slug: "kinshasa", city: place("Kinshasa"), country: place("DEMOCRATIC REPUBLIC OF THE CONGO", "RÉPUBLIQUE DÉMOCRATIQUE DU CONGO", "REPÚBLICA DEMOCRÁTICA DO CONGO") },
  { slug: "brazzaville", city: place("Brazzaville"), country: place("REPUBLIC OF THE CONGO", "RÉPUBLIQUE DU CONGO", "REPÚBLICA DO CONGO") },
];

// Attribution for the carousel photographs, as listed on each Wikimedia Commons file page
// (checked 2026-11-02; mirrors public/cities/CREDITS.md). Shown in the "Photo credits" dialog.
const commons = (file: string) => `https://commons.wikimedia.org/wiki/File:${file}`;
const PHOTO_CREDITS: Record<string, { author: string; licence: string; licenceUrl: string; source: string }> = {
  lisbon: { author: "Vitor Oliveira", licence: "CC BY-SA 2.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0/", source: commons("Lisboa_-_Portugal_(52597836992).jpg") },
  porto: { author: "Diego Delso", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: commons("Puente_Don_Luis_I,_Oporto,_Portugal,_2012-05-09,_DD_13.JPG") },
  montreal: { author: "Quintin Soloviev", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", source: commons("Montreal,_Quebec_skyline.jpg") },
  "quebec-city": { author: "Quintin Soloviev", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", source: commons("Quebec_City_skyline_from_L%C3%A9vis.jpg") },
  douala: { author: "Olivier Charly1", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: commons("Quarter_Bali_%C3%A0_Douala_Cameroun.jpg") },
  yaounde: { author: "Eavebe", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: commons("Yaound%C3%A9_1.jpg") },
  ndjamena: { author: "Kayhan Ertugrul", licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/", source: commons("Building_of_National_Assembly_DJAMENA.jpg") },
  libreville: { author: "Shirmy25", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: commons("Libreville_frond_de_mer.jpg") },
  malabo: { author: "Jmhi", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: commons("Hotel_de_Federaciones_02.jpg") },
  bangui: { author: "Afrika Force", licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/", source: commons("The_shores_of_Bangui.jpg") },
  kinshasa: { author: "Francis Shok Mweze", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", source: commons("La_Gombe,_Kinshasa,_RDC_(cropped).jpg") },
  brazzaville: { author: "Africany", licence: "CC0 1.0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/", source: commons("Les_lieux_de_Brazzaville_03.jpg") },
};

// Hero photographs rotate on their own timer, independent of the hero copy below.
// public/hero/ holds unmodified copies of the hero-section.images folder (AI-generated
// for this demo, not customer photographs); image-2.png
// is the two-glasses toast kept from the previous hero, shown unzoomed and still.
// Every other photo is zoomed slightly into its centre and drifts slowly in a fixed
// direction (see .kb-* in globals.css).
type HeroMotion = "still" | "ltr" | "rtl" | "up" | "down" | "rise" | "fall";
const HERO_PHOTOS: { src: string; motion: HeroMotion }[] = [
  { src: asset("/brand/image-2.png"), motion: "still" },
  { src: asset("/hero/Celebração de casamento no jardim.png"), motion: "ltr" },
  { src: asset("/hero/Conversa entre arte e vinho.png"), motion: "rtl" },
  { src: asset("/hero/Convívio de inverno num chalé alpino.png"), motion: "up" },
  { src: asset("/hero/Festa animada entre amigos em casa.png"), motion: "fall" },
  { src: asset("/hero/Festa de aniversário num terraço lisboeta.png"), motion: "down" },
  { src: asset("/hero/Jantar à Luz de Velas na Terraça.png"), motion: "rtl" },
  { src: asset("/hero/Jantar Aconchegante ao Luar.png"), motion: "ltr" },
  { src: asset("/hero/Jantar Romântico à Luz de Velas.png"), motion: "up" },
  { src: asset("/hero/Piquenique primaveril entre amigos.png"), motion: "rise" },
  { src: asset("/hero/Risos ao pôr do sol no mar.png"), motion: "down" },
  { src: asset("/hero/Selfie ao pôr do sol junto ao marb.png"), motion: "fall" },
];
const HERO_PHOTO_MS = 8000;
const HERO_TEXT_MS = 12000;
const HERO_TEXT_FADE_MS = 420;
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SLIDES = [
  { title: "One bottle. A world of stories.", body: "Discover the moments people share around A PONTE — from Portugal to the world." },
  { title: "Your moment deserves a place here.", body: "Take a photo featuring your A PONTE bottle and share the moment with our community." },
];

const SLIDE_COPY: Record<Language, { title: string; body: string }[]> = {
  EN: SLIDES.map(({ title, body }) => ({ title, body })),
  FR: [
    { title: "Une bouteille. Un monde d'histoires.", body: "Découvrez les moments partagés autour d'A PONTE, du Portugal au monde entier." },
    { title: "Votre moment a sa place ici.", body: "Prenez une photo avec votre bouteille A PONTE et partagez ce moment avec notre communauté." },
  ],
  PT: [
    { title: "Uma garrafa. Um mundo de histórias.", body: "Descubra os momentos partilhados à volta da A PONTE, de Portugal para o mundo." },
    { title: "O seu momento merece estar aqui.", body: "Tire uma fotografia com a sua garrafa A PONTE e partilhe esse momento com a nossa comunidade." },
  ],
};

const strings = {
  EN: {
    permissionRequired: "Please accept the publication permission before continuing. We need your permission to display your photograph in the A PONTE gallery and potentially share it on our social media.", backToDiscover: "Back to Discover", bottleTitle: "Would you like to win a free bottle?", bottleBody: "Do you want to win a free bottle? Tell us your email so we can send you the code!", emailLabel: "Your email", emailPlaceholder: "you@example.com", emailRequired: "Please enter your email address.", emailInvalid: "Please enter a valid email address, e.g. you@example.com.", getCode: "Get My Code", noThanks: "No thanks", thanksTitle: "Thank you for sharing your experience with us!", checkInbox: "Check your inbox!", emailDemoNote: "Demo only: nothing was uploaded, no email was sent and no code was generated.", shareDemoNote: "Demo only: nothing was uploaded or submitted.", visitWebsite: "Visit Website",
    captureTitle: "Share your experience", description: "Short description", descriptionPlaceholder: "Tell us about this moment...", permission: "I allow pontelusocan to use this photo in the discovery gallery and their social media in case it gets approved.", submitReview: "Submit for Review", 
    website: "Visit website", 
    galleryOutro1: "Every moment tells a story.", galleryOutro2: "What will yours be?", 
    discover: "Discover", moments: "Moments", shareNav: "Share", featured: "A glimpse into our world", featuredSub: "Moments, made to be remembered.", viewAll: "View All", shareExperience: "Share Experience", fromCommunity: "THE COMMUNITY", galleryTitle: "Moments worth sharing.", galleryBody: "Different places. The same joy of coming together.", galleryEmpty: "No moments shared from this country yet.", close: "Close", name: "Your name", shortName: "Name", cancel: "Cancel", photoCredits: "Photo credits", creditsIntro: "City photographs from Wikimedia Commons, shown under the licences below.", source: "Source" },
  FR: {
    permissionRequired: "Veuillez accepter l'autorisation de publication avant de continuer. Nous avons besoin de votre autorisation pour afficher votre photo dans la galerie A PONTE et éventuellement la partager sur nos réseaux sociaux.", backToDiscover: "Retour à Découvrir", bottleTitle: "Envie de gagner une bouteille offerte ?", bottleBody: "Vous voulez gagner une bouteille offerte ? Indiquez-nous votre e-mail pour que nous puissions vous envoyer le code !", emailLabel: "Votre e-mail", emailPlaceholder: "vous@exemple.com", emailRequired: "Veuillez indiquer votre adresse e-mail.", emailInvalid: "Veuillez indiquer une adresse e-mail valide, par ex. vous@exemple.com.", getCode: "Recevoir mon code", noThanks: "Non merci", thanksTitle: "Merci d'avoir partagé votre expérience avec nous !", checkInbox: "Consultez votre boîte de réception !", emailDemoNote: "Démonstration : rien n'a été téléversé, aucun e-mail n'a été envoyé et aucun code n'a été généré.", shareDemoNote: "Démonstration : rien n'a été téléversé ni envoyé.", visitWebsite: "Visiter le site",
    captureTitle: "Partagez votre expérience", description: "Courte description", descriptionPlaceholder: "Parlez-nous de ce moment...", permission: "J'autorise pontelusocan à utiliser cette photo dans la galerie découverte et sur ses réseaux sociaux si elle est approuvée.", submitReview: "Envoyer pour validation", 
    website: "Visiter le site", 
    galleryOutro1: "Chaque moment a une histoire.", galleryOutro2: "Quelle sera la vôtre ?", 
    discover: "Découvrir", moments: "Moments", shareNav: "Partager", featured: "Un aperçu de notre univers", featuredSub: "Des instants à ne pas oublier.", viewAll: "Voir tout", shareExperience: "Partager une expérience", fromCommunity: "LA COMMUNAUTÉ", galleryTitle: "Des moments à partager.", galleryBody: "Des lieux différents, le même plaisir d'être ensemble.", galleryEmpty: "Aucun moment partagé depuis ce pays pour l'instant.", close: "Fermer", name: "Votre nom", shortName: "Nom", cancel: "Annuler", photoCredits: "Crédits photo", creditsIntro: "Photographies de villes issues de Wikimedia Commons, utilisées selon les licences ci-dessous.", source: "Source" },
  PT: {
    permissionRequired: "Aceite a autorização de publicação antes de continuar. Precisamos da sua autorização para mostrar a sua fotografia na galeria A PONTE e, eventualmente, partilhá-la nas nossas redes sociais.", backToDiscover: "Voltar a Descobrir", bottleTitle: "Quer ganhar uma garrafa grátis?", bottleBody: "Quer ganhar uma garrafa grátis? Diga-nos o seu email para lhe enviarmos o código!", emailLabel: "O seu email", emailPlaceholder: "o.seu@exemplo.com", emailRequired: "Indique o seu endereço de email.", emailInvalid: "Indique um endereço de email válido, por ex. o.seu@exemplo.com.", getCode: "Receber o meu código", noThanks: "Não, obrigado", thanksTitle: "Obrigado por partilhar a sua experiência connosco!", checkInbox: "Verifique a sua caixa de entrada!", emailDemoNote: "Demonstração: nada foi carregado, nenhum email foi enviado e nenhum código foi gerado.", shareDemoNote: "Demonstração: nada foi carregado nem enviado.", visitWebsite: "Visitar o site",
    captureTitle: "Partilhe a sua experiência", description: "Breve descrição", descriptionPlaceholder: "Fale-nos deste momento...", permission: "Autorizo a pontelusocan a utilizar esta fotografia na galeria de descoberta e nas suas redes sociais, caso seja aprovada.", submitReview: "Enviar para revisão", 
    website: "Visitar o site", 
    galleryOutro1: "Cada momento conta uma história.", galleryOutro2: "Qual será a sua?", 
    discover: "Descobrir", moments: "Momentos", shareNav: "Partilhar", featured: "Um pouco do nosso mundo", featuredSub: "Momentos que merecem ser recordados.", viewAll: "Ver tudo", shareExperience: "Partilhar experiência", fromCommunity: "A COMUNIDADE", galleryTitle: "Momentos para partilhar.", galleryBody: "Lugares diferentes. O mesmo prazer de estar juntos.", galleryEmpty: "Ainda não há momentos partilhados deste país.", close: "Fechar", name: "O seu nome", shortName: "Nome", cancel: "Cancelar", photoCredits: "Créditos fotográficos", creditsIntro: "Fotografias das cidades provenientes do Wikimedia Commons, utilizadas ao abrigo das licenças abaixo.", source: "Fonte" },
} satisfies Record<Language, Record<string, string>>;

function Icon({ name, size = 19, stroke = 1.6 }: { name: string; size?: number; stroke?: number }) {
  const paths: Record<string, ReactNode> = {
    compass: <><circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4L16 8Z"/></>,
    images: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 16-5.5-5.5L5 21"/></>,
    plus: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    play: <path d="m8.5 5.5 10 6.5-10 6.5v-13Z"/>,
    arrow: <><path d="M4 12h16"/><path d="m14 6 6 6-6 6"/></>,
    left: <><path d="m15 18-6-6 6-6"/></>,
    back: <><path d="M20 12H4"/><path d="m10 18-6-6 6-6"/></>,
    right: <><path d="m9 18 6-6-6-6"/></>,
    x: <><path d="m5 5 14 14M19 5 5 19"/></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    camera: <><path d="M3 7h4l2-2h6l2 2h4v12H3z"/><circle cx="12" cy="13" r="3"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    check: <><path d="m5 12 4.5 4.5L19 7"/></>,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 17v4h16v-4"/></>,
    external: <><path d="M10 5H5v14h14v-5"/><path d="M14 5h5v5M19 5l-9 9"/></>,
    wine: <><path d="M7 3h10v5c0 4-2 6-5 6S7 12 7 8V3ZM12 14v7m-5 0h10M7 8h10"/></>,
    circle: <><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.compass}</svg>;
}

function Wordmark({ live = true }: { live?: boolean }) {
  return <span className="brand-lockup"><img className="bridge-mark" src={asset("/brand/logo.png")} alt=""/>{live && <><span className="wordmark-divider"/><span className="wordmark-live">LIVE</span></>}</span>;
}

function Photo({ src, alt, className = "", art = true }: { src: string; alt: string; className?: string; art?: boolean }) {
  const photoMatch = src.match(/photo-([^?]+)/);
  const photoId = photoMatch?.[1] || "";
  const styles: Record<string, number> = {
    "1510812431401-41d2bd2722f3": 0,
    "1414235077428-338989a2e8c0": 2,
    "1506377247377-2a5b3b417ebb": 1,
    "1511795409834-ef04bbd61622": 3,
    "1528823872057-9c018a7a7553": 0,
    "1528605248644-14dd04022da1": 2,
    "1498804103079-a6351b050096": 4,
    "1519167758481-83f550bb49b3": 3,
    "1531058020387-3be344556be6": 4,
  };
  const fallback = styles[photoId] ?? 0;
  return <div className={`photo ${className}`} style={art ? {backgroundImage: `url(${asset(`/art/wine-${fallback}.svg`)})`, backgroundPosition: "center", backgroundSize: "cover"} : undefined}><img src={src} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} /></div>;
}

// One hero photograph. Later layers fade in over the previous one once their image
// has loaded, so the crossfade never reveals an empty (black) frame.
function HeroLayer({ src, motion, fadeIn }: { src: string; motion: HeroMotion; fadeIn: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(!fadeIn);
  useEffect(() => { if (img.current?.complete && img.current.naturalWidth) setLoaded(true); }, []);
  return <div className={`hero-photo hero-layer ${fadeIn ? "fade-in" : ""} ${loaded ? "is-loaded" : ""}`}><img ref={img} src={src} alt="" className={`kb-${motion}`} fetchPriority={fadeIn ? "auto" : "high"} decoding="async" onLoad={() => setLoaded(true)}/></div>;
}

function ShareExperienceLink({ label }: { label: string }) {
  return <Link href="/live/share" className="btn btn-white share-experience"><Icon name="camera" size={16}/>{label}</Link>;
}

function Nav({ current, text }: { current: Screen; text: typeof strings.EN }) {
  return <nav className="bottom-nav" aria-label="A PONTE Live navigation">
    <Link href="/live" className={`nav-link ${current === "live" ? "active" : ""}`} aria-current={current === "live" ? "page" : undefined}><Icon name="compass" size={20}/><span>{text.discover}</span></Link>
    <Link href="/live/moments" className={`nav-link ${current === "moments" ? "active" : ""}`} aria-current={current === "moments" ? "page" : undefined}><Icon name="images" size={20}/><span>{text.moments}</span></Link>
    <Link href="/live/share" className={`nav-link ${current === "share" ? "active" : ""}`} aria-current={current === "share" ? "page" : undefined}><Icon name="plus" size={20}/><span>{text.shareNav}</span></Link>
  </nav>;
}

export default function Experience({ screen }: { screen: Screen }) {
  const [lang, setLang] = useState<Language>("EN");
  // Each photo change is a new "shot" layered on the last two, so a fade always has a picture beneath it.
  const [shots, setShots] = useState([{ id: 0, photo: 0 }]);
  const [heroText, setHeroText] = useState({ index: 0, leaving: false, entering: false });
  const [pageVisible, setPageVisible] = useState(true);
  const [country, setCountry] = useState<CountryFilter>("all");
  const [chosen, setChosen] = useState<Moment | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsTrigger = useRef<HTMLButtonElement>(null);
  const creditsWasOpen = useRef(false);
  const [formError, setFormError] = useState(false);
  const [stage, setStage] = useState<ShareStage>("review");
  const [leavingStage, setLeavingStage] = useState(false);
  const [emailChoice, setEmailChoice] = useState<"provided" | "declined">("declined");
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<"" | "required" | "invalid">("");
  const stageRef = useRef<HTMLDivElement>(null);
  const stageChanged = useRef(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  // Mouse drag-to-scroll for the community carousel (touch and trackpads scroll natively).
  const carouselDrag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressCarouselClick = useRef(false);
  const t = strings[lang];

  useEffect(() => {
    const saved = window.localStorage.getItem("aponte-live-demo-lang");
    if (saved === "EN" || saved === "PT" || saved === "FR") setLang(saved);
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const currentShot = shots[shots.length - 1];

  // Photo timer: restarts whenever the photo changes, including from the arrows.
  // The following photo is fetched a few seconds in, once the current one has had the bandwidth.
  useEffect(() => {
    if (screen !== "live" || !pageVisible) return;
    const preload = window.setTimeout(() => { new Image().src = HERO_PHOTOS[(currentShot.photo + 1) % HERO_PHOTOS.length].src; }, 3000);
    const advance = window.setTimeout(() => showPhoto(1), HERO_PHOTO_MS);
    return () => { window.clearTimeout(preload); window.clearTimeout(advance); };
  }, [screen, pageVisible, currentShot.id, currentShot.photo]);

  // Text timer: independent of the photos, and untouched by the arrows.
  useEffect(() => {
    if (screen !== "live" || !pageVisible) return;
    let swap: number | undefined;
    const next = ({ index }: { index: number }) => ({ index: (index + 1) % SLIDES.length, leaving: false, entering: !prefersReducedMotion() });
    const id = window.setInterval(() => {
      if (prefersReducedMotion()) { setHeroText(next); return; }
      setHeroText((s) => ({ ...s, leaving: true }));
      swap = window.setTimeout(() => setHeroText(next), HERO_TEXT_FADE_MS);
    }, HERO_TEXT_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(swap);
      setHeroText((s) => (s.leaving ? { ...s, leaving: false } : s));
    };
  }, [screen, pageVisible]);

  // Each new share stage starts at the top, with focus on its heading.
  useEffect(() => {
    if (!stageChanged.current) return;
    stageRef.current?.closest(".screen-scroll")?.scrollTo(0, 0);
    stageRef.current?.querySelector("h1")?.focus({ preventScroll: true });
  }, [stage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setChosen(null); setIsLangOpen(false); setCreditsOpen(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Closing the credits dialog (X, Escape or backdrop) returns focus to its link.
  useEffect(() => {
    if (creditsOpen) creditsWasOpen.current = true;
    else if (creditsWasOpen.current) creditsTrigger.current?.focus({ preventScroll: true });
  }, [creditsOpen]);

  // Close the language dropdown on any outside click, as the site's Navbar does.
  useEffect(() => {
    if (!isLangOpen) return;
    const close = () => setIsLangOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [isLangOpen]);

  function changeLang(l: Language) {
    setLang(l);
    setIsLangOpen(false);
    window.localStorage.setItem("aponte-live-demo-lang", l);
  }

  function startCarouselDrag(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button === 0) carouselDrag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
  }

  function moveCarouselDrag(e: PointerEvent<HTMLDivElement>) {
    const drag = carouselDrag.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      e.currentTarget.classList.add("dragging");
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (drag.moved) e.currentTarget.scrollLeft = drag.left - dx;
  }

  function endCarouselDrag(e: PointerEvent<HTMLDivElement>) {
    if (carouselDrag.current?.moved) {
      // A drag must not also count as a click on the "View All" card.
      suppressCarouselClick.current = true;
      window.setTimeout(() => { suppressCarouselClick.current = false; }, 0);
    }
    carouselDrag.current = null;
    e.currentTarget.classList.remove("dragging");
  }

  function showPhoto(step: 1 | -1) {
    setShots((s) => {
      const last = s[s.length - 1];
      return [...s.slice(-2), { id: last.id + 1, photo: (last.photo + step + HERO_PHOTOS.length) % HERO_PHOTOS.length }];
    });
  }

  // Short fade-out before the next stage fades in; immediate when reduced motion is requested.
  function goToStage(next: ShareStage) {
    stageChanged.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setStage(next); return; }
    setLeavingStage(true);
    window.setTimeout(() => { setStage(next); setLeavingStage(false); }, 180);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) { setFormError(true); return; }
    setFormError(false);
    goToStage("email");
  }

  function handleEmail(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();
    if (!value) { setEmailError("required"); return; }
    if (!EMAIL_PATTERN.test(value)) { setEmailError("invalid"); return; }
    setEmailError("");
    setEmailChoice("provided");
    goToStage("thankYou");
  }

  const shownMoments = MOMENTS.filter((moment) => matchesFilter(moment.countryCode, country));

  return <main className="demo-stage">
    <div className={`phone phone-${screen}`} id="phone">
      {screen === "share" && <div className="capture-backdrop" aria-hidden="true"><img src={CAPTURED_PHOTO} alt=""/></div>}
      {screen === "share" && <Link href="/live" className="capture-close" aria-label={t.backToDiscover}><Icon name="back" size={20}/></Link>}
      <div className="phone-safe"/>
      {screen !== "share" && <header className="site-header">
        <Link href="/live" aria-label="A PONTE Live home" className="logo-link"><Wordmark/></Link>
        <div className="header-actions">
          <div className="lang-switcher">
            <button type="button" className="lang-toggle" aria-label="Choose language" aria-expanded={isLangOpen} aria-haspopup="true" onClick={(e) => { e.stopPropagation(); setIsLangOpen((open) => !open); }}>
              <span className={`lang-flag fi ${LANGUAGES.find((l) => l.code === lang)?.flagClass ?? ""}`} aria-hidden="true"/>
              <span className={`lang-chevron ${isLangOpen ? "open" : ""}`} aria-hidden="true">▼</span>
            </button>
            <div className={`lang-dropdown ${isLangOpen ? "open" : ""}`} role="menu" onClick={(e) => e.stopPropagation()}>
              {LANGUAGES.map((option) => <button key={option.code} type="button" role="menuitem" tabIndex={isLangOpen ? 0 : -1} className={`lang-option ${lang === option.code ? "active" : ""}`} onClick={() => changeLang(option.code)}><span className={`lang-flag fi ${option.flagClass}`} aria-hidden="true"/>{option.label}</button>)}
            </div>
          </div>
          <a className="website-pill" href={COMPANY_URL} target="_blank" rel="noopener noreferrer"><span>{t.website}</span><Icon name="external" size={12}/></a>
        </div>
      </header>}

      <div className="screen-scroll" key={screen}>

        {screen === "live" && <section className="live-screen">
          <div className="hero-carousel">
            <div className="hero-photos" aria-hidden="true">{shots.map((shot) => <HeroLayer key={shot.id} {...HERO_PHOTOS[shot.photo]} fadeIn={shot.id > 0}/>)}</div>
            <div className="hero-dark"/>
            <div className="hero-content"><div key={heroText.index} className={`hero-copy ${heroText.entering ? "is-entering" : ""} ${heroText.leaving ? "is-leaving" : ""}`}><h1>{SLIDE_COPY[lang][heroText.index].title}</h1><p>{SLIDE_COPY[lang][heroText.index].body}</p></div></div>
            <div className="slide-controls"><div className="slide-arrows"><button type="button" aria-label="Previous photo" onClick={() => showPhoto(-1)}><Icon name="left"/></button><button type="button" aria-label="Next photo" onClick={() => showPhoto(1)}><Icon name="right"/></button></div></div>
          </div>
          <section className="featured-section"><span className="eyebrow gold-text">{t.fromCommunity}</span><h2>{t.featured}</h2><p>{t.featuredSub}</p><div className="featured-carousel" role="region" aria-label={t.featured} tabIndex={0} onPointerDown={startCarouselDrag} onPointerMove={moveCarouselDrag} onPointerUp={endCarouselDrag} onPointerCancel={endCarouselDrag} onDragStart={(e) => e.preventDefault()} onClickCapture={(e) => { if (suppressCarouselClick.current) { e.preventDefault(); e.stopPropagation(); } }}>
            {CITIES.map((c) => <figure key={c.slug} className="featured-tile"><Photo src={asset(`/cities/${c.slug}.jpg`)} alt={`Illustrative photograph of ${c.city.EN}`}/><figcaption><span>{c.city[lang]}</span><small>{c.country[lang]}</small></figcaption></figure>)}
            <Link href="/live/moments" className="featured-tile featured-view-all"><span>{t.viewAll}</span><Icon name="arrow" size={22}/></Link>
          </div><ShareExperienceLink label={t.shareExperience}/><button ref={creditsTrigger} type="button" className="credits-link" onClick={() => setCreditsOpen(true)}>{t.photoCredits}</button></section>
        </section>}

        {screen === "moments" && <section className="moments-screen">
          <div className="interior-head"><span className="eyebrow gold-text">{t.fromCommunity}</span><h1>{t.galleryTitle}</h1><p>{t.galleryBody}</p></div>
          <div className="filter-section"><div className="filter-pills" aria-label="Filter gallery by country">{COUNTRY_FILTERS.map(c => <button key={c} type="button" className={`filter-chip ${country === c ? "chosen" : ""}`} onClick={(e) => { setCountry(c); e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" }); }} aria-pressed={country === c}>{FILTER_LABELS[c][lang]}</button>)}</div></div>
          {shownMoments.length > 0 ? <div className="masonry">{shownMoments.map(m => <button type="button" key={m.id} className={`moment-tile moment-${m.height}`} onClick={() => setChosen(m)} aria-label={`${m.title} — ${m.city}, ${m.country}`}><Photo src={m.image} alt={m.title}/><div className="moment-overlay"/><div className="moment-meta"><span className="moment-location"><Icon name="pin" size={12}/>{m.city}</span><strong>{m.title}</strong></div></button>)}</div> : <p className="empty">{t.galleryEmpty}</p>}
          <div className="gallery-outro"><p>{t.galleryOutro1}<br/><em>{t.galleryOutro2}</em></p><ShareExperienceLink label={t.shareExperience}/></div>
        </section>}

        {screen === "share" && <section className="capture-screen">
          <div key={stage} ref={stageRef} className={`capture-stage ${leavingStage ? "leaving" : ""}`}>
            {stage === "review" && <form onSubmit={handleSubmit} className="capture-form" noValidate>
              <h1 tabIndex={-1}>{t.captureTitle}</h1>
              <label>{t.name}<input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name"/></label>
              <label>{t.description}<textarea rows={3} placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}/></label>
              <label className="capture-consent"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setFormError(false); }}/><span className="capture-check" aria-hidden="true"><Icon name="check" size={13} stroke={2.4}/></span><span>{t.permission}</span></label>
              {/* Faded, not disabled: it stays clickable so an unchecked permission gets explained. */}
              <button type="submit" className={`btn btn-white capture-submit ${consent ? "" : "is-inactive"}`} aria-describedby={formError ? "permission-error" : undefined}>{t.submitReview}</button>
              {formError && <p id="permission-error" className="capture-error" role="alert">{t.permissionRequired}</p>}
            </form>}
            {stage === "email" && <form onSubmit={handleEmail} className="capture-form capture-centered" noValidate>
              <h1 tabIndex={-1}>{t.bottleTitle}</h1>
              <p className="capture-lede">{t.bottleBody}</p>
              <label className="capture-field">{t.emailLabel}<input type="email" inputMode="email" autoComplete="email" placeholder={t.emailPlaceholder} value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} aria-invalid={emailError ? true : undefined} aria-describedby={emailError ? "email-error" : undefined} maxLength={120}/></label>
              {emailError && <p id="email-error" className="capture-error" role="alert">{emailError === "required" ? t.emailRequired : t.emailInvalid}</p>}
              <button type="submit" className="btn btn-white capture-submit">{t.getCode}</button>
              <button type="button" className="capture-skip" onClick={() => { setEmailError(""); setEmailChoice("declined"); goToStage("thankYou"); }}>{t.noThanks}</button>
            </form>}
            {stage === "thankYou" && <div className="capture-form capture-centered" role="status">
              <h1 tabIndex={-1}>{t.thanksTitle}</h1>
              {emailChoice === "provided" && <p className="capture-lede">{t.checkInbox}</p>}
              <a className="btn btn-white capture-submit" href={COMPANY_URL} target="_blank" rel="noopener noreferrer">{t.visitWebsite}<Icon name="external" size={15}/></a>
              <p className="capture-demo-note">{emailChoice === "provided" ? t.emailDemoNote : t.shareDemoNote}</p>
            </div>}
          </div>
        </section>}
      </div>

      {screen !== "share" && <Nav current={screen} text={t}/>}
      <div className="phone-bottom-safe"/>

      {chosen && <div className="modal-backdrop moment-backdrop" onClick={() => setChosen(null)}><section className="moment-dialog" role="dialog" aria-modal="true" aria-label={chosen.title} onClick={e => e.stopPropagation()}><button className="modal-close" type="button" onClick={() => setChosen(null)} aria-label={t.close}><Icon name="x" size={21}/></button><div className="dialog-media"><Photo src={chosen.image} alt={chosen.title} className="dialog-photo"/><div className="dialog-body"><h2>{chosen.title}</h2><p>{chosen.note}</p></div></div><div className="dialog-byline"><span><Icon name="pin" size={15}/>{chosen.city}, {chosen.country}</span><span>{chosen.author}</span></div></section></div>}
      {creditsOpen && <div className="modal-backdrop moment-backdrop" onClick={() => setCreditsOpen(false)}><section className="credits-dialog" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={e => e.stopPropagation()}><button className="modal-close" type="button" autoFocus onClick={() => setCreditsOpen(false)} aria-label={t.close}><Icon name="x" size={21}/></button><h2 id="credits-title">{t.photoCredits}</h2><p>{t.creditsIntro}</p><ul>{CITIES.map((c) => { const credit = PHOTO_CREDITS[c.slug]; return <li key={c.slug}><strong>{c.city[lang]}</strong><span>{credit.author} · <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer">{credit.licence}</a> · <a href={credit.source} target="_blank" rel="noopener noreferrer">{t.source}</a></span></li>; })}</ul></section></div>}
    </div>
  </main>;
}
