const welcome = {
  EN: {
    subject: "Welcome to A PONTE Live — confirm your email",
    title: "Welcome to A PONTE Live",
    intro: "Thank you for joining our community. A PONTE Live is a place to share the moments you celebrate with A PONTE and discover the stories others have shared.",
    instruction: "Confirm your email address to activate your account, share your photos, and explore the A PONTE Private Circle.",
    action: "Confirm my email",
    note: "This link is valid for 24 hours. If you didn’t create an A PONTE Live account, you can ignore this email.",
    signature: "The A PONTE Live team",
  },
  FR: {
    subject: "Bienvenue sur A PONTE Live — confirmez votre e-mail",
    title: "Bienvenue sur A PONTE Live",
    intro: "Merci de rejoindre notre communauté. A PONTE Live vous invite à partager les moments que vous célébrez avec A PONTE et à découvrir les histoires des autres membres.",
    instruction: "Confirmez votre adresse e-mail pour activer votre compte, partager vos photos et découvrir le Cercle privé A PONTE.",
    action: "Confirmer mon adresse e-mail",
    note: "Ce lien est valable 24 heures. Si vous n’avez pas créé de compte A PONTE Live, vous pouvez ignorer cet e-mail.",
    signature: "L’équipe A PONTE Live",
  },
  PT: {
    subject: "Bem-vindo à A PONTE Live — confirme o seu email",
    title: "Bem-vindo à A PONTE Live",
    intro: "Obrigado por se juntar à nossa comunidade. Na A PONTE Live, pode partilhar os momentos que celebra com a A PONTE e descobrir as histórias de outros membros.",
    instruction: "Confirme o seu email para ativar a conta, partilhar as suas fotografias e descobrir o Círculo Privado A PONTE.",
    action: "Confirmar o meu email",
    note: "Esta ligação é válida durante 24 horas. Se não criou uma conta A PONTE Live, pode ignorar este email.",
    signature: "A equipa A PONTE Live",
  },
};

export const resetSubjects = {
  EN: "Reset your A PONTE Live password",
  FR: "Réinitialisez votre mot de passe A PONTE Live",
  PT: "Redefina a sua palavra-passe A PONTE Live",
};

export function verificationEmail(language: string, url: URL) {
  const locale = language === "FR" || language === "PT" ? language : "EN";
  const copy = welcome[locale];
  const href = url.href.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return {
    subject: copy.subject,
    text: [copy.title, copy.intro, copy.instruction, copy.action, url.href, copy.note, copy.signature].join("\n\n"),
    html: `<!doctype html><html lang="${locale.toLowerCase()}"><body>
      <main style="max-width:560px;margin:0 auto;padding:24px;font-family:Arial,sans-serif;color:#222;line-height:1.6">
        <h1 style="font-size:24px;line-height:1.25">${copy.title}</h1>
        <p>${copy.intro}</p>
        <p>${copy.instruction}</p>
        <p><a href="${href}" style="color:#0056b3;font-weight:bold;text-decoration:underline">${copy.action}</a></p>
        <p><em>${copy.note}</em></p>
        <p>${copy.signature}</p>
      </main></body></html>`,
  };
}
