"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import Icon from "./Icon";
import { circleCopy, type LiveLanguage } from "./PrivateCircle";
import { clearLink, linkParameters, memberRequest, type Member, type MemberPhoto } from "@/lib/share/member-client";

const translations = {
  EN: {
    register: "Create an account", login: "Log in", username: "Username", email: "Email", password: "Password",
    accountReason: "Your account keeps track of your contributions and future Private Circle benefits.",
    passwordHelp: "Up to 15 characters.", repeat: "Repeat password", show: "Show password", hide: "Hide password",
    strength: ["Weak", "Fair", "Strong"], strengthLabel: "Password strength", adult: "I confirm that I am 18 or older.",
    mismatch: "The passwords don’t match.", ageError: "Confirm that you are 18 or older.", deleteAccount: "Delete test account",
    confirmDelete: "Delete this test account and its photos? You can reuse the email and username.", deleted: "Test account deleted.", relationship: "Your relationship with A PONTE",
    roles: ["Customer", "Partner", "Distributor", "Other"], company: "Company name (optional)",
    verify: "Verify your email", sent: "Open the verification link in your email, then return here.", resend: "Resend email",
    check: "Check verification", logout: "Sign out", forgot: "Forgot your password?", reset: "Reset password", settings: "Account settings",
    resetSent: "If there is a verified account for this address, a reset link will arrive by email.",
    changed: "Password updated. Sign in to continue.", verified: "Email verified. Sign in if prompted.",
    verifyAction: "Confirm email address", save: "Save profile", edit: "Edit profile", displayName: "Display name (optional)",
    avatar: "Profile photo (optional)", remove: "Remove profile photo", submitted: "Photos submitted", approved: "Photos approved",
    loading: "Loading…", privacy: "Privacy notice",
    states: {pending: "Pending", approved: "Approved", declined: "Declined"},
    unavailable: "Accounts are available in the connected staging app.", membership: "Membership levels are being developed.",
    errors: {verify_sign_in: "Sign in with the account this verification link was sent to.", invalid_login: "Check your email and password.", invalid_fields: "Check the information you entered.", account_exists: "This email or username is already in use.", invalid_link: "This link has expired or already been used.", mail_unavailable: "Email delivery is temporarily unavailable. Try again later.", rate_limited: "Too many attempts. Wait a minute and try again.", default: "Something went wrong. Please try again."},
  },
  FR: {
    register: "Créer un compte", login: "Se connecter", username: "Nom d’utilisateur", email: "E-mail", password: "Mot de passe",
    accountReason: "Votre compte permet de suivre vos contributions et vos futurs avantages du Cercle privé.",
    passwordHelp: "15 caractères maximum.", repeat: "Confirmer le mot de passe", show: "Afficher le mot de passe", hide: "Masquer le mot de passe",
    strength: ["Faible", "Moyen", "Fort"], strengthLabel: "Solidité du mot de passe", adult: "Je confirme avoir 18 ans ou plus.",
    mismatch: "Les mots de passe ne correspondent pas.", ageError: "Confirmez que vous avez 18 ans ou plus.", deleteAccount: "Supprimer le compte de test",
    confirmDelete: "Supprimer ce compte de test et ses photos ? Vous pourrez réutiliser l’e-mail et le nom d’utilisateur.", deleted: "Compte de test supprimé.", relationship: "Votre lien avec A PONTE",
    roles: ["Client", "Partenaire", "Distributeur", "Autre"], company: "Entreprise (facultatif)",
    verify: "Vérifiez votre e-mail", sent: "Ouvrez le lien reçu par e-mail, puis revenez ici.", resend: "Renvoyer l’e-mail",
    check: "Vérifier le statut", logout: "Se déconnecter", forgot: "Mot de passe oublié ?", reset: "Réinitialiser le mot de passe", settings: "Paramètres du compte",
    resetSent: "Si un compte vérifié correspond à cette adresse, vous recevrez un lien par e-mail.",
    changed: "Mot de passe modifié. Connectez-vous pour continuer.", verified: "Adresse vérifiée. Connectez-vous si nécessaire.",
    verifyAction: "Confirmer l’adresse e-mail", save: "Enregistrer le profil", edit: "Modifier le profil", displayName: "Nom affiché (facultatif)",
    avatar: "Photo de profil (facultative)", remove: "Supprimer la photo de profil", submitted: "Photos envoyées", approved: "Photos approuvées",
    loading: "Chargement…", privacy: "Confidentialité",
    states: {pending: "En attente", approved: "Approuvée", declined: "Refusée"},
    unavailable: "Les comptes sont disponibles dans l’application de test connectée.", membership: "Les niveaux sont en cours de définition.",
    errors: {verify_sign_in: "Connectez-vous au compte associé à ce lien de vérification.", invalid_login: "Vérifiez votre e-mail et votre mot de passe.", invalid_fields: "Vérifiez les informations saisies.", account_exists: "Cette adresse ou ce nom d’utilisateur est déjà utilisé.", invalid_link: "Ce lien a expiré ou a déjà été utilisé.", mail_unavailable: "L’envoi d’e-mails est temporairement indisponible.", rate_limited: "Trop de tentatives. Réessayez dans une minute.", default: "Une erreur est survenue. Veuillez réessayer."},
  },
  PT: {
    register: "Criar conta", login: "Iniciar sessão", username: "Nome de utilizador", email: "Email", password: "Palavra-passe",
    accountReason: "A sua conta permite acompanhar as suas contribuições e os futuros benefícios do Círculo Privado.",
    passwordHelp: "Até 15 caracteres.", repeat: "Repetir palavra-passe", show: "Mostrar palavra-passe", hide: "Ocultar palavra-passe",
    strength: ["Fraca", "Razoável", "Forte"], strengthLabel: "Força da palavra-passe", adult: "Confirmo que tenho 18 anos ou mais.",
    mismatch: "As palavras-passe não coincidem.", ageError: "Confirme que tem 18 anos ou mais.", deleteAccount: "Eliminar conta de teste",
    confirmDelete: "Eliminar esta conta de teste e as suas fotografias? Pode reutilizar o email e o nome de utilizador.", deleted: "Conta de teste eliminada.", relationship: "A sua relação com a A PONTE",
    roles: ["Cliente", "Parceiro", "Distribuidor", "Outro"], company: "Empresa (opcional)",
    verify: "Confirme o seu email", sent: "Abra a ligação que recebeu por email e volte aqui.", resend: "Reenviar email",
    check: "Verificar estado", logout: "Terminar sessão", forgot: "Esqueceu-se da palavra-passe?", reset: "Redefinir palavra-passe", settings: "Definições da conta",
    resetSent: "Se existir uma conta verificada para este endereço, receberá uma ligação por email.",
    changed: "Palavra-passe alterada. Inicie sessão para continuar.", verified: "Email confirmado. Inicie sessão se necessário.",
    verifyAction: "Confirmar endereço de email", save: "Guardar perfil", edit: "Editar perfil", displayName: "Nome visível (opcional)",
    avatar: "Fotografia de perfil (opcional)", remove: "Remover fotografia de perfil", submitted: "Fotografias enviadas", approved: "Fotografias aprovadas",
    loading: "A carregar…", privacy: "Privacidade",
    states: {pending: "Pendente", approved: "Aprovada", declined: "Recusada"},
    unavailable: "As contas estão disponíveis na aplicação de testes ligada ao serviço.", membership: "Os níveis ainda estão a ser definidos.",
    errors: {verify_sign_in: "Inicie sessão na conta associada a esta ligação de confirmação.", invalid_login: "Verifique o email e a palavra-passe.", invalid_fields: "Verifique os dados introduzidos.", account_exists: "Este email ou nome de utilizador já está em uso.", invalid_link: "Esta ligação expirou ou já foi utilizada.", mail_unavailable: "O envio de emails está temporariamente indisponível.", rate_limited: "Demasiadas tentativas. Tente novamente dentro de um minuto.", default: "Ocorreu um erro. Tente novamente."},
  },
};
const roles = ["customer", "partner", "distributor", "other"];
type Mode = "choice" | "register" | "login" | "forgot" | "verify" | "reset";

function passwordStrength(value: string) {
  const length = Array.from(value).length;
  if (length < 8 || new Set(value.toLowerCase()).size < 5 || /password|qwerty|12345|senha|palavra/i.test(value)) return 0;
  return length >= 12 && new Set(value.toLowerCase()).size >= 8 ? 2 : 1;
}

function PasswordField({label, name, isNew, t, onChange}: {
  label: string; name: string; isNew: boolean; t: typeof translations[LiveLanguage]; onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="member-password">
    <label>{label}<input type={visible ? "text" : "password"} name={name}
      autoComplete={isNew ? "new-password" : "current-password"}
      maxLength={isNew ? 15 : 128} required onChange={event => onChange?.(event.target.value)}/></label>
    <button type="button" aria-label={visible ? t.hide : t.show} onClick={() => setVisible(!visible)}>
      <Icon name={visible ? "eyeOff" : "eye"} size={18}/>
    </button>
  </div>;
}

async function avatarFrom(file: File) {
  if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("invalid_fields");
  const bitmap = await createImageBitmap(file);
  try {
    const size = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 192;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("invalid_fields");
    context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 192, 192);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally { bitmap.close(); }
}

export default function MemberPanel({language, enabled, draft, onVerified, onOpenPhoto}: {
  language: LiveLanguage; enabled: boolean; draft?: string; onVerified?: () => void; onOpenPhoto?: (photo: MemberPhoto, status: string) => void;
}) {
  const t = translations[language];
  const circle = circleCopy[language];
  const [mode, setMode] = useState<Mode>(onVerified ? "choice" : "login");
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [repeated, setRepeated] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifyLogin, setVerifyLogin] = useState(false);
  const [token, setToken] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState("");
  const [photos, setPhotos] = useState<MemberPhoto[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const params = linkParameters();
    if (params.get("verify") || params.get("reset")) {
      setMode(params.get("verify") ? "verify" : "reset");
      setToken(params.get("verify") ?? params.get("reset") ?? "");
    }
    memberRequest<{member: Member | null}>("session")
      .then(value => { if (active) setMember(value.member); })
      .catch(() => { if (active) setError("default"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !member?.verified || onVerified || token) return;
    let active = true;
    memberRequest<{photos: MemberPhoto[]}>("photos").then(result => { if (active) setPhotos(result.photos); })
      .catch(() => { if (active) setError("default"); });
    return () => { active = false; };
  }, [enabled, member, onVerified, token]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "default"); }
    finally { setBusy(false); }
  }

  async function auth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (mode === "register" || mode === "reset") {
      if (fields.password !== fields.passwordConfirmation) { setError("password_mismatch"); return; }
    }
    await run(async () => {
      if (mode === "verify" && (!member || verifyLogin)) {
        const session = await memberRequest<{member: Member}>("login", fields);
        setMember(session.member);
      }
      let response: {member?: Member; mailFailed?: boolean};
      try { response = await memberRequest(mode, {...fields, adult: fields.adult === "on", language, draft, token}); }
      catch (failure) {
        if (failure instanceof Error && failure.message === "verify_sign_in") setVerifyLogin(true);
        throw failure;
      }
      if (response.member) {
        setMember(response.member);
        if (response.mailFailed) setError("mail_unavailable");
        if (response.member.verified) onVerified?.();
      }
      if (mode === "forgot") setNotice(t.resetSent);
      if (mode === "verify" || mode === "reset") {
        clearLink();
        setToken("");
        setMode("login");
        setNotice(mode === "verify" ? t.verified : t.changed);
        const session = await memberRequest<{member: Member | null}>("session");
        setMember(session.member);
        if (session.member?.verified) onVerified?.();
      }
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      const result = await memberRequest<{member: Member}>("profile", {displayName: fields.displayName, company: fields.company, avatar});
      setMember(result.member);
      setEditing(false);
    });
  }

  const button = "btn btn-white capture-submit";
  const pending = Boolean(member && !member.verified && !token);
  const profile = Boolean(member?.verified && !token);
  const verificationNeedsLogin = mode === "verify" && (!member || verifyLogin);
  const choosingPassword = mode === "register" || mode === "reset";
  const score = passwordStrength(password);
  const errorText = error === "password_mismatch" ? t.mismatch : error === "age_required" ? t.ageError : t.errors[error as keyof typeof t.errors] ?? t.errors.default;

  function removeTestAccount() {
    if (!window.confirm(t.confirmDelete)) return;
    void run(async () => {
      await memberRequest("delete-test-account", {});
      setMember(null);
      setPhotos(null);
      setEditing(false);
      setSettingsOpen(false);
      setMode(onVerified ? "choice" : "login");
      setNotice(t.deleted);
    });
  }

  useEffect(() => { setPassword(""); setRepeated(""); }, [mode]);

  return <section className="capture-form member-panel">
    {loading ? <p role="status">{t.loading}</p> : !enabled ? <><h1>{circle.account}</h1><p>{t.unavailable}</p></> :
      profile && member ? <>
        <h1>{circle.account}</h1>
        <div className="member-identity">
          <div className="member-avatar">{member.avatar ? <img src={member.avatar} alt=""/> : <Icon name="person" size={35}/>}</div>
          <div className="member-identity-copy">
            <h2>{member.displayName || member.username}</h2>
            <p>{t.roles[roles.indexOf(member.relationship)] ?? t.roles[3]}</p>
          </div>
        </div>
        {onVerified ? <button className={button} onClick={onVerified}>{circle.share}</button> : <>
          <div className="member-counts"><span><strong>{photos?.length ?? "—"}</strong>{t.submitted}</span><span><strong>{photos?.filter(p => p.status === "approved").length ?? "—"}</strong>{t.approved}</span></div>
          {photos && photos.length > 0 && <ul className="member-photos">{photos.map(photo => (
            <li key={photo.id}>
              <button type="button" className="member-photo-tile" data-status={photo.status} aria-label={`${photo.description} · ${t.states[photo.status]}`} onClick={() => onOpenPhoto?.(photo, t.states[photo.status])}>
                <img loading="lazy" decoding="async" src={"/api/members/photos/" + photo.id} alt=""/>
                {photo.status !== "approved" && <span>{t.states[photo.status]}</span>}
              </button>
            </li>
          ))}</ul>}
          <p><strong>{circle.title}</strong><br/>{t.membership}</p>
          <button className="capture-skip" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>{t.settings}</button>
          {settingsOpen && <div className="member-actions">
            <span>{member.email}</span>
            <button className="capture-skip" disabled={busy} onClick={() => run(async () => {
              await memberRequest("forgot", {email: member.email});
              setNotice(t.resetSent);
            })}>{t.reset}</button>
            <button className="capture-skip" disabled={busy} onClick={removeTestAccount}>{t.deleteAccount}</button>
          </div>}
          {editing ? <form className="member-fields" onSubmit={save}>
            <label>{t.displayName}<input name="displayName" defaultValue={member.displayName} maxLength={60}/></label>
            <label>{t.company}<input name="company" defaultValue={member.company} maxLength={100}/></label>
            <label>{t.avatar}<input type="file" accept="image/*" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void run(async () => setAvatar(await avatarFrom(file))); }}/></label>
            {avatar && <button className="capture-skip" type="button" onClick={() => setAvatar("")}>{t.remove}</button>}
            <button className={button} disabled={busy}>{t.save}</button>
          </form> : <button className="capture-skip" onClick={() => { setAvatar(member.avatar); setEditing(true); }}>{t.edit}</button>}
        </>}
        <button className="capture-skip" disabled={busy} onClick={() => run(async () => { await memberRequest("logout", {}); setMember(null); setPhotos(null); setEditing(false); setSettingsOpen(false); setMode("login"); })}>{t.logout}</button>
      </> : pending ? <>
        <h1>{t.verify}</h1><p>{t.sent}</p>
        <button className={button} disabled={busy} onClick={() => run(async () => {
          const session = await memberRequest<{member: Member | null}>("session");
          setMember(session.member);
          if (session.member?.verified) onVerified?.();
          else if (session.member) setNotice(t.sent);
        })}>{t.check}</button>
        <button className="capture-skip" disabled={busy} onClick={removeTestAccount}>{t.deleteAccount}</button>
        <button className="capture-skip" disabled={busy} onClick={() => run(async () => { await memberRequest("resend", {draft}); setNotice(t.sent); })}>{t.resend}</button>
        <button className="capture-skip" disabled={busy} onClick={() => run(async () => { await memberRequest("logout", {}); setMember(null); setMode("login"); })}>{t.logout}</button>
      </> : mode === "choice" ? <>
        <h1>{circle.account}</h1>
        <p className="capture-lede capture-centered">{t.accountReason}</p>
        <button className={button} onClick={() => setMode("login")}>{t.login}</button>
        <button className="btn btn-outline capture-submit" onClick={() => setMode("register")}>{t.register}</button>
      </> : <>
        <h1>{mode === "verify" ? t.verify : t[mode]}</h1>
        <form key={mode} className="member-fields" onSubmit={auth}>
          {mode === "register" && <label>{t.username}<input name="username" autoComplete="username" minLength={3} maxLength={40} required/></label>}
          {((mode !== "verify" && mode !== "reset") || verificationNeedsLogin) && <div className={mode === "login" ? "member-login-email" : undefined}>
            {mode === "login" && <div className="member-login-backdrop" aria-hidden="true">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/login-waiter.webp`} alt="" decoding="async"/>
              <span className="hero-dark"/>
            </div>}
            <label>{t.email}<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
          </div>}
          {((mode !== "verify" && mode !== "forgot") || verificationNeedsLogin) && <PasswordField label={t.password} name="password" t={t} isNew={choosingPassword} onChange={choosingPassword ? setPassword : undefined}/>}
          {choosingPassword && <>
            <small>{t.passwordHelp}</small>
            {password && <div className="member-strength">
              <meter className={`member-strength-${score}`} aria-label={t.strengthLabel} min={0} max={3} value={score + 1}/>
              <small>{t.strengthLabel} · {t.strength[score]}</small>
            </div>}
            <PasswordField label={t.repeat} name="passwordConfirmation" t={t} isNew onChange={setRepeated}/>
            {repeated && password !== repeated && <small className="capture-error">{t.mismatch}</small>}
          </>}
          {mode === "register" && <>
            <label>{t.relationship}<select name="relationship" defaultValue="customer">{roles.map((role, i) => <option key={role} value={role}>{t.roles[i]}</option>)}</select></label>
            <label>{t.company}<input name="company" autoComplete="organization" maxLength={100}/></label>
            <label className="member-age"><input type="checkbox" name="adult" required/><span>{t.adult}</span></label>
          </>}
          <button className={button} disabled={busy}>{mode === "verify" ? t.verifyAction : t[mode]}</button>
        </form>
        {!token && <div className="member-actions">
          {mode !== "login" && <button className="capture-skip" onClick={() => {setMode("login"); setError(""); setNotice("");}}>{t.login}</button>}
          {mode !== "register" && <button className="capture-skip" onClick={() => {setMode("register"); setError(""); setNotice("");}}>{t.register}</button>}
          {mode === "login" && <button className="capture-skip" onClick={() => {setMode("forgot"); setError(""); setNotice("");}}>{t.forgot}</button>}
        </div>}
      </>}
    {error && <p className="capture-error" role="alert">{errorText}</p>}
    {notice && <p role="status">{notice}</p>}
    <Link href="/live/privacy/" className="capture-skip">{t.privacy}</Link>
  </section>;
}
