"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import CameraCapture from "@/components/share/CameraCapture";
import LocationStep from "@/components/share/LocationStep";
import { type CameraErrorKind, canUseCamera, consumeCameraRequest, requestCameraOnArrival } from "@/lib/share/camera";
import type { ShareLocation } from "@/lib/share/location";
import { type CapturedPhoto, photoFromFile, useObjectUrl } from "@/lib/share/photo";
import { STAGING_UPLOADS, uploadSubmission, type ShareSubmission } from "@/lib/share/submission";
import UploadVerification from "@/components/share/UploadVerification";
import {uploadCopy} from "@/lib/share/upload-copy";

import PrivateCircle, {circleCopy} from "@/components/PrivateCircle";
import MemberPanel from "@/components/MemberPanel";
import {linkParameters, loadDraft, memberRequest, removeDraft, saveDraft, type Member} from "@/lib/share/member-client";

type Screen = "live" | "moments" | "share" | "account";
type ShareStage = "start" | "camera" | "location" | "review" | "account" | "thankYou";
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

// Same order, labels and flag-icons classes as the institutional site's Navbar.tsx.
const LANGUAGES: { code: Language; label: string; flagClass: string }[] = [
  { code: "FR", label: "Français", flagClass: "fi-fr" },
  { code: "EN", label: "English", flagClass: "fi-gb" },
  { code: "PT", label: "Português", flagClass: "fi-pt" },
];
// Blurred behind the Share screen until the visitor has taken or chosen their own photo.
const SHARE_PLACEHOLDER_PHOTO = asset("/brand/image-2.png");
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
  { title: "Discover the A PONTE Private Circle.", body: "Share your moments and discover a closer connection with A PONTE." },
  { title: "More moments. More possibilities.", body: "Discover exclusive experiences and privileges as your connection with A PONTE grows." },
  { title: "One bottle. A world of stories.", body: "Discover the moments our members share around A PONTE — from Portugal to the world." },
  { title: "Your moment deserves a place here.", body: "Take a photo featuring your A PONTE bottle, share the moment and become part of our community." },
];

const SLIDE_COPY: Record<Language, { title: string; body: string }[]> = {
  EN: SLIDES.map(({ title, body }) => ({ title, body })),
  FR: [
    { title: "Découvrez le Cercle privé A PONTE.", body: "Partagez vos moments et tissez des liens plus étroits avec A PONTE." },
    { title: "Plus de moments. Plus de possibilités.", body: "Découvrez des expériences et des privilèges exclusifs à mesure que votre lien avec A PONTE grandit." },
    { title: "Une bouteille. Un monde d'histoires.", body: "Découvrez les moments que nos membres partagent autour d’A PONTE, du Portugal au monde entier." },
    { title: "Votre moment a sa place ici.", body: "Prenez une photo avec votre bouteille A PONTE partagez ce moment et rejoignez notre communauté." },
  ],
  PT: [
    { title: "Descubra o Círculo Privado A PONTE.", body: "Partilhe os seus momentos e aproxime-se da A PONTE." },
    { title: "Mais momentos. Mais possibilidades.", body: "Descubra experiências e privilégios exclusivos à medida que se aproxima da A PONTE." },
    { title: "Uma garrafa. Um mundo de histórias.", body: "Descubra os momentos que os nossos membros partilham à volta da A PONTE, de Portugal para o mundo." },
    { title: "O seu momento merece estar aqui.", body: "Tire uma fotografia com a sua garrafa A PONTE partilhe esse momento e faça parte da nossa comunidade." },
  ],
};

const strings = {
  EN: {
    permissionRequired: "Please accept the publication permission before continuing. We need your permission to display your photograph in the A PONTE gallery and potentially share it on our social media.", backToDiscover: "Back to Discover", thanksTitle: "Thank you for sharing your experience with us!", shareDemoNote: "Preview only: your photo stayed on this device. Nothing was uploaded, stored or submitted for review.", visitWebsite: "Visit Website",
    captureTitle: "Share your experience", description: "Short description", descriptionPlaceholder: "Tell us about this moment...", permission: "I allow pontelusocan to use this photo in the discovery gallery and their social media in case it gets approved.", submitReview: "Submit for Review", 
    website: "Visit website", 
    galleryOutro1: "Every moment tells a story.", galleryOutro2: "What will yours be?", 
    discover: "Discover", moments: "Moments", shareNav: "Share", featured: "A glimpse into our world", featuredSub: "Moments, made to be remembered.", viewAll: "View All", shareExperience: "Share Experience", fromCommunity: "THE COMMUNITY", galleryTitle: "Moments worth sharing.", galleryBody: "Different places. The same joy of coming together.", galleryEmpty: "No moments shared from this country yet.", close: "Close", name: "Your name", shortName: "Name", cancel: "Cancel", photoCredits: "Photo credits", creditsIntro: "City photographs from Wikimedia Commons, shown under the licences below.", source: "Source",
    startLede: "Take a photo of your moment with your A PONTE bottle.", openCamera: "Open Camera", nativeCamera: "Use my phone's camera", choosePhoto: "Choose from my photos", keepPhoto: "Keep my current photo", retakePhoto: "Retake photo", cameraLabel: "Camera", cameraStarting: "Starting camera…", capturePhoto: "Take photo", retake: "Retake", usePhoto: "Use photo", closeCamera: "Close camera", capturedAlt: "Your photo", cameraDenied: "Camera access was blocked. You can allow it in your browser settings, or use your phone's camera or a saved photo instead.", cameraUnsupported: "This browser can't open the camera here. Use your phone's camera or choose a saved photo instead.", cameraUnavailable: "No camera was found on this device. Choose a saved photo instead.", cameraBusy: "The camera is being used by another app. Close it and try again, or choose a saved photo.", cameraFailed: "The camera couldn't be started. Try again, or choose a saved photo.", captureFailed: "The photo couldn't be taken. Please try again.", photoUnreadable: "This photo couldn't be opened. Please choose a JPEG or PNG image.",
    locationTitle: "Where was this moment?", locationLede: "Adding your city and country is optional. It helps place your moment in the gallery.", detectLocation: "Detect my location", locationDisclosure: "Your browser will ask for permission. Your approximate position is then sent to {provider}, an external service, only to look up your city and country. Your coordinates are not saved or shown.", locating: "Finding your location…", locationFound: "Location found. You can correct it below.", locationDenied: "Location access was declined. You can type your city and country instead.", locationTimeout: "Finding your location took too long. Try again or type it below.", locationUnavailable: "Your location isn't available right now. You can type it below.", locationUnsupported: "This browser can't share your location. You can type it below.", lookupFailed: "We couldn't find a city for your position. You can type it below.", city: "City", cityPlaceholder: "e.g. Lisbon", countryLabel: "Country", chooseCountry: "Choose a country", otherCountry: "Other country", otherCountryName: "Country name", continue: "Continue", skipLocation: "Skip", addLocation: "Add location" },
  FR: {
    permissionRequired: "Veuillez accepter l'autorisation de publication avant de continuer. Nous avons besoin de votre autorisation pour afficher votre photo dans la galerie A PONTE et éventuellement la partager sur nos réseaux sociaux.", backToDiscover: "Retour à Découvrir", thanksTitle: "Merci d'avoir partagé votre expérience avec nous !", shareDemoNote: "Aperçu uniquement : votre photo est restée sur cet appareil. Rien n'a été téléversé, enregistré ni envoyé pour validation.", visitWebsite: "Visiter le site",
    captureTitle: "Partagez votre expérience", description: "Courte description", descriptionPlaceholder: "Parlez-nous de ce moment...", permission: "J'autorise pontelusocan à utiliser cette photo dans la galerie découverte et sur ses réseaux sociaux si elle est approuvée.", submitReview: "Envoyer pour validation", 
    website: "Visiter le site", 
    galleryOutro1: "Chaque moment a une histoire.", galleryOutro2: "Quelle sera la vôtre ?", 
    discover: "Découvrir", moments: "Moments", shareNav: "Partager", featured: "Un aperçu de notre univers", featuredSub: "Des instants à ne pas oublier.", viewAll: "Voir tout", shareExperience: "Partager une expérience", fromCommunity: "LA COMMUNAUTÉ", galleryTitle: "Des moments à partager.", galleryBody: "Des lieux différents, le même plaisir d'être ensemble.", galleryEmpty: "Aucun moment partagé depuis ce pays pour l'instant.", close: "Fermer", name: "Votre nom", shortName: "Nom", cancel: "Annuler", photoCredits: "Crédits photo", creditsIntro: "Photographies de villes issues de Wikimedia Commons, utilisées selon les licences ci-dessous.", source: "Source",
    startLede: "Prenez une photo de votre moment avec votre bouteille A PONTE.", openCamera: "Ouvrir l'appareil photo", nativeCamera: "Utiliser l'appareil photo du téléphone", choosePhoto: "Choisir dans mes photos", keepPhoto: "Garder ma photo actuelle", retakePhoto: "Reprendre la photo", cameraLabel: "Appareil photo", cameraStarting: "Ouverture de l'appareil photo…", capturePhoto: "Prendre la photo", retake: "Reprendre", usePhoto: "Utiliser la photo", closeCamera: "Fermer l'appareil photo", capturedAlt: "Votre photo", cameraDenied: "L'accès à l'appareil photo a été bloqué. Vous pouvez l'autoriser dans les réglages de votre navigateur, ou utiliser l'appareil photo de votre téléphone ou une photo enregistrée.", cameraUnsupported: "Ce navigateur ne peut pas ouvrir l'appareil photo ici. Utilisez l'appareil photo de votre téléphone ou choisissez une photo enregistrée.", cameraUnavailable: "Aucun appareil photo n'a été trouvé sur cet appareil. Choisissez plutôt une photo enregistrée.", cameraBusy: "L'appareil photo est utilisé par une autre application. Fermez-la et réessayez, ou choisissez une photo enregistrée.", cameraFailed: "Impossible de démarrer l'appareil photo. Réessayez ou choisissez une photo enregistrée.", captureFailed: "La photo n'a pas pu être prise. Veuillez réessayer.", photoUnreadable: "Cette photo n'a pas pu être ouverte. Choisissez une image JPEG ou PNG.",
    locationTitle: "Où ce moment a-t-il eu lieu ?", locationLede: "Indiquer votre ville et votre pays est facultatif. Cela permet de situer votre moment dans la galerie.", detectLocation: "Détecter ma position", locationDisclosure: "Votre navigateur vous demandera l'autorisation. Votre position approximative est ensuite envoyée à {provider}, un service externe, uniquement pour trouver votre ville et votre pays. Vos coordonnées ne sont ni enregistrées ni affichées.", locating: "Recherche de votre position…", locationFound: "Position trouvée. Vous pouvez la corriger ci-dessous.", locationDenied: "L'accès à la position a été refusé. Vous pouvez saisir votre ville et votre pays.", locationTimeout: "La recherche de votre position a pris trop de temps. Réessayez ou saisissez-la ci-dessous.", locationUnavailable: "Votre position n'est pas disponible pour le moment. Vous pouvez la saisir ci-dessous.", locationUnsupported: "Ce navigateur ne peut pas partager votre position. Vous pouvez la saisir ci-dessous.", lookupFailed: "Nous n'avons pas trouvé de ville pour votre position. Vous pouvez la saisir ci-dessous.", city: "Ville", cityPlaceholder: "ex. Lisbonne", countryLabel: "Pays", chooseCountry: "Choisir un pays", otherCountry: "Autre pays", otherCountryName: "Nom du pays", continue: "Continuer", skipLocation: "Passer", addLocation: "Ajouter un lieu" },
  PT: {
    permissionRequired: "Aceite a autorização de publicação antes de continuar. Precisamos da sua autorização para mostrar a sua fotografia na galeria A PONTE e, eventualmente, partilhá-la nas nossas redes sociais.", backToDiscover: "Voltar a Descobrir", thanksTitle: "Obrigado por partilhar a sua experiência connosco!", shareDemoNote: "Apenas pré-visualização: a sua fotografia ficou neste dispositivo. Nada foi carregado, guardado nem enviado para revisão.", visitWebsite: "Visitar o site",
    captureTitle: "Partilhe a sua experiência", description: "Breve descrição", descriptionPlaceholder: "Fale-nos deste momento...", permission: "Autorizo a pontelusocan a utilizar esta fotografia na galeria de descoberta e nas suas redes sociais, caso seja aprovada.", submitReview: "Enviar para revisão", 
    website: "Visitar o site", 
    galleryOutro1: "Cada momento conta uma história.", galleryOutro2: "Qual será a sua?", 
    discover: "Descobrir", moments: "Momentos", shareNav: "Partilhar", featured: "Um pouco do nosso mundo", featuredSub: "Momentos que merecem ser recordados.", viewAll: "Ver tudo", shareExperience: "Partilhar experiência", fromCommunity: "A COMUNIDADE", galleryTitle: "Momentos para partilhar.", galleryBody: "Lugares diferentes. O mesmo prazer de estar juntos.", galleryEmpty: "Ainda não há momentos partilhados deste país.", close: "Fechar", name: "O seu nome", shortName: "Nome", cancel: "Cancelar", photoCredits: "Créditos fotográficos", creditsIntro: "Fotografias das cidades provenientes do Wikimedia Commons, utilizadas ao abrigo das licenças abaixo.", source: "Fonte",
    startLede: "Tire uma fotografia do seu momento com a sua garrafa A PONTE.", openCamera: "Abrir câmara", nativeCamera: "Usar a câmara do telemóvel", choosePhoto: "Escolher das minhas fotografias", keepPhoto: "Manter a fotografia atual", retakePhoto: "Repetir fotografia", cameraLabel: "Câmara", cameraStarting: "A abrir a câmara…", capturePhoto: "Tirar fotografia", retake: "Repetir", usePhoto: "Usar fotografia", closeCamera: "Fechar câmara", capturedAlt: "A sua fotografia", cameraDenied: "O acesso à câmara foi bloqueado. Pode autorizá-lo nas definições do navegador, ou usar a câmara do telemóvel ou uma fotografia guardada.", cameraUnsupported: "Este navegador não consegue abrir a câmara aqui. Use a câmara do telemóvel ou escolha uma fotografia guardada.", cameraUnavailable: "Não foi encontrada nenhuma câmara neste dispositivo. Escolha antes uma fotografia guardada.", cameraBusy: "A câmara está a ser usada por outra aplicação. Feche-a e tente novamente, ou escolha uma fotografia guardada.", cameraFailed: "Não foi possível iniciar a câmara. Tente novamente ou escolha uma fotografia guardada.", captureFailed: "Não foi possível tirar a fotografia. Tente novamente.", photoUnreadable: "Não foi possível abrir esta fotografia. Escolha uma imagem JPEG ou PNG.",
    locationTitle: "Onde foi este momento?", locationLede: "Indicar a sua cidade e país é opcional. Ajuda a situar o seu momento na galeria.", detectLocation: "Detetar a minha localização", locationDisclosure: "O seu navegador irá pedir autorização. A sua posição aproximada é depois enviada à {provider}, um serviço externo, apenas para encontrar a sua cidade e país. As suas coordenadas não são guardadas nem mostradas.", locating: "A procurar a sua localização…", locationFound: "Localização encontrada. Pode corrigi-la abaixo.", locationDenied: "O acesso à localização foi recusado. Pode escrever a sua cidade e país.", locationTimeout: "A procura da sua localização demorou demasiado. Tente novamente ou escreva-a abaixo.", locationUnavailable: "A sua localização não está disponível neste momento. Pode escrevê-la abaixo.", locationUnsupported: "Este navegador não consegue partilhar a sua localização. Pode escrevê-la abaixo.", lookupFailed: "Não encontrámos uma cidade para a sua posição. Pode escrevê-la abaixo.", city: "Cidade", cityPlaceholder: "ex. Lisboa", countryLabel: "País", chooseCountry: "Escolher um país", otherCountry: "Outro país", otherCountryName: "Nome do país", continue: "Continuar", skipLocation: "Saltar", addLocation: "Adicionar localização" },
} satisfies Record<Language, Record<string, string>>;
export type Text = typeof strings.EN;

const CAMERA_MESSAGES: Record<CameraErrorKind, keyof Text> = {
  unsupported: "cameraUnsupported", denied: "cameraDenied", unavailable: "cameraUnavailable", busy: "cameraBusy", failed: "cameraFailed",
};

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
  return <Link href="/live/share" className="btn btn-white share-experience" onClick={requestCameraOnArrival}><Icon name="camera" size={16}/>{label}</Link>;
}

function Nav({ current, text, account }: { current: Screen; text: typeof strings.EN; account: string }) {
  return <nav className="bottom-nav" aria-label="A PONTE Live navigation">
    <Link href="/live" className={`nav-link ${current === "live" ? "active" : ""}`} aria-current={current === "live" ? "page" : undefined}><Icon name="compass" size={20}/><span>{text.discover}</span></Link>
    <Link href="/live/moments" className={`nav-link ${current === "moments" ? "active" : ""}`} aria-current={current === "moments" ? "page" : undefined}><Icon name="images" size={20}/><span>{text.moments}</span></Link>
    <Link href="/live/share" className={`nav-link ${current === "share" ? "active" : ""}`} aria-current={current === "share" ? "page" : undefined} onClick={requestCameraOnArrival}><Icon name="plus" size={20}/><span>{text.shareNav}</span></Link>
    <Link href="/live/account" className={`nav-link ${current === "account" ? "active" : ""}`} aria-current={current === "account" ? "page" : undefined}><Icon name="person" size={20}/><span>{account}</span></Link>
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
  const [stage, setStage] = useState<ShareStage>("start");
  const [leavingStage, setLeavingStage] = useState(false);
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const photoUrl = useObjectUrl(photo?.file ?? null);
  const [cameraError, setCameraError] = useState<CameraErrorKind | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [location, setLocation] = useState<ShareLocation | null>(null);
  const locationAnswered = useRef(false);
  const submission = useRef<ShareSubmission | null>(null);
  const nativeCameraInput = useRef<HTMLInputElement>(null);
  const photoLibraryInput = useRef<HTMLInputElement>(null);
  const [draftId, setDraftId] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [cameraFallback, setCameraFallback] = useState(false);
  const [introSeen, setIntroSeen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [processingConsent, setProcessingConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploadError, setUploadError] = useState<"" | "failed" | "fileError" | "waitError" | "unavailable">("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationAttempt, setVerificationAttempt] = useState(0);
  const [receipt, setReceipt] = useState("");
  // Reuse the id on retries, but allocate another if any submitted content changes.
  const uploadIdentity = useRef<{signature: string; photo: File; id: string} | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const stageChanged = useRef(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  // Mouse drag-to-scroll for the community carousel (touch and trackpads scroll natively).
  const carouselDrag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressCarouselClick = useRef(false);
  const t = strings[lang];
  const u = uploadCopy[lang];
  const circle = circleCopy[lang];

  useEffect(() => {
    if (screen !== "share" || !STAGING_UPLOADS) return;
    let active = true;
    const params = linkParameters();
    if (params.has("verify")) {
      setStage("account");
      const id = params.get("draft");
      if (id) void loadDraft(id).then(draft => {
        if (!active || !draft) return;
        const saved = draft.submission;
        setPhoto(saved.photo);
        setName(saved.name);
        setDescription(saved.description);
        setLocation(saved.location ? {...saved.location, source: "manual"} : null);
        locationAnswered.current = true;
        setProcessingConsent(true);
        setConsent(saved.publicationConsent);
        setDraftId(draft.id);
        uploadIdentity.current = {id: draft.id, photo: saved.photo.file, signature: JSON.stringify({name: saved.name, description: saved.description, location: saved.location, lang: saved.language, consent: saved.publicationConsent})};
      }).catch(() => { if (active) setUploadError("failed"); });
    }
    void memberRequest<{member: Member | null}>("session").then(result => {
      if (active) setSignedIn(Boolean(result.member?.verified));
    }).catch(() => {});
    return () => { active = false; };
  }, [screen]);

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

  // Share opens the camera straight away when the visitor got here by tapping a Share link;
  // otherwise the start screen offers Open Camera. Never requested on any other screen.
  useEffect(() => {
    if (screen !== "share") return;
    if (!canUseCamera()) setCameraError("unsupported");
    else if (!linkParameters().has("verify") && consumeCameraRequest()) setStage("camera");
  }, [screen]);

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

  // Denied, unsupported and missing cameras won't change on a retry; the photo inputs remain.
  const cameraAvailable = cameraError === null || cameraError === "busy" || cameraError === "failed";

  // Immediate rather than faded, so getUserMedia runs in the same tap.
  function openCameraView() {
    setCameraError(null);
    setPhotoError(false);
    stageChanged.current = true;
    setStage("camera");
  }

  function handleCameraError(kind: CameraErrorKind) {
    setCameraError(kind);
    setCameraFallback(!introSeen);
    setIntroSeen(true);
    stageChanged.current = true;
    setStage("start");
  }

  function acceptPhoto(next: CapturedPhoto) {
    setPhoto(next);
    setIntroSeen(true);
    setPhotoError(false);
    // A retake goes back to the form; the location question is only asked once.
    goToStage(locationAnswered.current ? "review" : "location");
  }

  async function handlePhotoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      acceptPhoto(await photoFromFile(file));
    } catch {
      setPhotoError(true);
    }
  }

  function retakePhoto() {
    if (cameraAvailable) openCameraView();
    else goToStage("start");
  }

  function handleLocation(next: ShareLocation | null) {
    setLocation(next);
    locationAnswered.current = true;
    goToStage("review");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (uploadLock.current) return;
    if (!photo) { goToStage("start"); return; }
    if (STAGING_UPLOADS ? (!processingConsent || !name.trim() || !description.trim() || (signedIn && !verificationToken)) : !consent) { setFormError(true); return; }
    setFormError(false);
    submission.current = {
      photo,
      name: name.trim(),
      description: description.trim(),
      publicationConsent: consent,
      location: location && { city: location.city, countryCode: location.countryCode, country: location.country },
      language: lang,
    };
    if (STAGING_UPLOADS) {
      uploadLock.current = true;
      setUploading(true);
      setUploadError("");
      const signature = JSON.stringify({name: name.trim(), description: description.trim(), location, lang, consent});
      if (uploadIdentity.current?.signature !== signature || uploadIdentity.current.photo !== photo.file) {
        uploadIdentity.current = {signature, photo: photo.file, id: crypto.randomUUID()};
      }
      try {
        const session = await memberRequest<{member: Member | null}>("session");
        setSignedIn(Boolean(session.member?.verified));
        if (!session.member?.verified) {
          const id = uploadIdentity.current.id;
          await saveDraft({id, submission: submission.current, expires: Date.now() + 86400_000});
          setDraftId(id);
          goToStage("account");
          return;
        }
        if (!verificationToken) { setFormError(true); return; }
        const result = await uploadSubmission(submission.current, uploadIdentity.current.id, verificationToken);
        setReceipt(result.id);
        if (draftId) void removeDraft(draftId).catch(() => {});
        goToStage("thankYou");
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        setUploadError(["invalid_image", "image_dimensions", "image_processing", "image_too_large"].includes(code) ? "fileError"
          : ["rate_limited", "processing_retry"].includes(code) ? "waitError"
          : ["staging_limit", "uploads_unavailable"].includes(code) ? "unavailable" : "failed");
      }
      finally {
        uploadLock.current = false;
        setUploading(false);
        setVerificationToken("");
        setVerificationAttempt(n => n + 1);
      }
      return;
    }
    goToStage("account");
  }

  const shownMoments = MOMENTS.filter((moment) => matchesFilter(moment.countryCode, country));

  return <main className="demo-stage">
    <div className={`phone phone-${screen}`} id="phone">
      {screen === "share" && <div className="capture-backdrop" aria-hidden="true"><img src={photoUrl ?? SHARE_PLACEHOLDER_PHOTO} alt=""/></div>}
      {screen === "share" && stage !== "camera" && <Link href="/live" className="capture-close" aria-label={t.backToDiscover}><Icon name="back" size={20}/></Link>}
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
          <PrivateCircle language={lang}/>
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

        {screen === "account" && <section className="capture-screen"><MemberPanel language={lang} enabled={STAGING_UPLOADS}/></section>}

        {screen === "share" && <section className={`capture-screen ${stage === "start" && cameraFallback ? "circle-camera-fallback" : ""}`}>
          <div key={stage} ref={stageRef} className={`capture-stage ${leavingStage ? "leaving" : ""}`}>
            {stage === "start" && <div className="capture-form capture-centered">
              <h1 tabIndex={-1}>{cameraFallback ? circle.cameraTitle : t.captureTitle}</h1>
              <p className="capture-lede">{cameraFallback ? circle.cameraBody : t.startLede}</p>
              {cameraError && <p className="capture-error" role="alert">{t[CAMERA_MESSAGES[cameraError]]}</p>}
              {photoError && <p className="capture-error" role="alert">{t.photoUnreadable}</p>}
              {cameraAvailable
                ? <button type="button" className="btn btn-white capture-submit" onClick={openCameraView}><Icon name="camera" size={16}/>{t.openCamera}</button>
                : cameraError !== "unavailable" && <button type="button" className="btn btn-white capture-submit" onClick={() => nativeCameraInput.current?.click()}><Icon name="camera" size={16}/>{t.nativeCamera}</button>}
              <button type="button" className={cameraError === "unavailable" ? "btn btn-white capture-submit" : "capture-skip"} onClick={() => photoLibraryInput.current?.click()}>{t.choosePhoto}</button>
              {photo && <button type="button" className="capture-skip" onClick={() => goToStage(locationAnswered.current ? "review" : "location")}>{t.keepPhoto}</button>}
              {/* Fallbacks that need no camera permission: the phone's own camera app, or its photo picker. */}
              <input ref={nativeCameraInput} type="file" accept="image/*" capture="environment" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={handlePhotoFile}/>
            </div>}
            {stage === "location" && <LocationStep text={t} language={lang.toLowerCase()} markets={MARKETS.map((code) => ({ code, label: FILTER_LABELS[code][lang] }))} initial={location} onDone={handleLocation}/>}
            {stage === "review" && <form onSubmit={handleSubmit} className="capture-form" noValidate>
              <h1 tabIndex={-1}>{t.captureTitle}</h1>
              {STAGING_UPLOADS && <p className="capture-demo-note">{u.staging}</p>}
              <fieldset disabled={uploading} style={{border: 0, padding: 0, margin: 0, minWidth: 0, display: "contents"}}>
              <div className="capture-meta">
                <button type="button" onClick={() => goToStage("location")}><Icon name="pin" size={14}/>{location ? [location.city, location.country].filter(Boolean).join(", ") : t.addLocation}</button>
                <button type="button" onClick={retakePhoto}><Icon name="camera" size={14}/>{t.retakePhoto}</button>
              </div>
              <label>{t.name}<input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name"/></label>
              <label>{t.description}<textarea rows={3} placeholder={t.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300}/></label>
              {STAGING_UPLOADS && <>
                <label className="capture-consent"><input type="checkbox" checked={processingConsent} onChange={e => setProcessingConsent(e.target.checked)}/><span className="capture-check" aria-hidden="true"><Icon name="check" size={13}/></span><span>{u.processing} <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/live/privacy/`} target="_blank" rel="noopener noreferrer">{u.privacy}</a></span></label>
              </>}
              <label className="capture-consent"><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setFormError(false); }}/><span className="capture-check" aria-hidden="true"><Icon name="check" size={13} stroke={2.4}/></span><span>{t.permission}{STAGING_UPLOADS && ` (${u.optional})`}</span></label>
              </fieldset>
              {STAGING_UPLOADS && signedIn && <UploadVerification attempt={verificationAttempt} language={lang} onToken={setVerificationToken}/>}
              {/* Faded, not disabled: it stays clickable so an unchecked permission gets explained. */}
              <button type="submit" disabled={uploading} className={`btn btn-white capture-submit ${(STAGING_UPLOADS ? processingConsent : consent) ? "" : "is-inactive"}`} aria-describedby={formError ? "permission-error" : undefined}>{uploading ? u.sending : t.submitReview}</button>
              {formError && <p id="permission-error" className="capture-error" role="alert">{STAGING_UPLOADS ? u.required : t.permissionRequired}</p>}
              {uploadError && <p className="capture-error" role="alert">{u[uploadError]}</p>}
            </form>}
            {stage === "account" && <MemberPanel language={lang} enabled={STAGING_UPLOADS} draft={draftId} onVerified={() => {
              setSignedIn(true);
              goToStage(photo ? "review" : "start");
            }}/>}
            {stage === "thankYou" && <div className="capture-form capture-centered" role="status">
              <h1 tabIndex={-1}>{t.thanksTitle}</h1>
              <a className="btn btn-white capture-submit" href={COMPANY_URL} target="_blank" rel="noopener noreferrer">{t.visitWebsite}<Icon name="external" size={15}/></a>
              {STAGING_UPLOADS && receipt ? <><p className="capture-lede">{u.success}</p><p className="capture-demo-note">{u.reference}: {receipt}</p></> : <p className="capture-demo-note">{t.shareDemoNote}</p>}
            </div>}
          </div>
        </section>}
      </div>

      {screen === "share" && <input ref={photoLibraryInput} type="file" accept="image/*" className="visually-hidden" tabIndex={-1} aria-hidden="true" onChange={handlePhotoFile}/>}
      {screen === "share" && stage === "camera" && <CameraCapture text={t} intro={introSeen ? undefined : circle}
        onIntroDone={() => setIntroSeen(true)} onChoose={() => photoLibraryInput.current?.click()} onCapture={acceptPhoto} onError={handleCameraError} onCancel={() => {
        stageChanged.current = true;
        setStage(!photo ? "start" : locationAnswered.current ? "review" : "location");
      }}/>}

      {screen !== "share" && <Nav current={screen} text={t} account={circle.account}/>}
      <div className="phone-bottom-safe"/>

      {chosen && <div className="modal-backdrop moment-backdrop" onClick={() => setChosen(null)}><section className="moment-dialog" role="dialog" aria-modal="true" aria-label={chosen.title} onClick={e => e.stopPropagation()}><button className="modal-close" type="button" onClick={() => setChosen(null)} aria-label={t.close}><Icon name="x" size={21}/></button><div className="dialog-media"><Photo src={chosen.image} alt={chosen.title} className="dialog-photo"/><div className="dialog-body"><h2>{chosen.title}</h2><p>{chosen.note}</p></div></div><div className="dialog-byline"><span><Icon name="pin" size={15}/>{chosen.city}, {chosen.country}</span><span>{chosen.author}</span></div></section></div>}
      {creditsOpen && <div className="modal-backdrop moment-backdrop" onClick={() => setCreditsOpen(false)}><section className="credits-dialog" role="dialog" aria-modal="true" aria-labelledby="credits-title" onClick={e => e.stopPropagation()}><button className="modal-close" type="button" autoFocus onClick={() => setCreditsOpen(false)} aria-label={t.close}><Icon name="x" size={21}/></button><h2 id="credits-title">{t.photoCredits}</h2><p>{t.creditsIntro}</p><ul>{CITIES.map((c) => { const credit = PHOTO_CREDITS[c.slug]; return <li key={c.slug}><strong>{c.city[lang]}</strong><span>{credit.author} · <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer">{credit.licence}</a> · <a href={credit.source} target="_blank" rel="noopener noreferrer">{t.source}</a></span></li>; })}</ul></section></div>}
    </div>
  </main>;
}
