// Used for proper routing of assets in edge and agent deployments
const _errorsBasePath = (() => {
  const src = document.currentScript?.src;
  if (src) return src.substring(0, src.lastIndexOf("/"));
  return "/_fs-ch-1T1wmsGaOgGaSxcX";
})();

const _t = (() => {
  try {
    const tr = {
      en: {
        somethingWrong: "Oops, something went wrong.",
        checkConnection:
          "Please check your connection, disable any ad blockers, or try using a different browser.",
        cookiesDisabled: "It looks like cookies are disabled in your browser.",
        enableCookies: "Please enable cookies to continue.",
        companyLogoAlt: "Company Logo",
        fastlyLogoAlt: "Fastly Logo",
      },
      fr: {
        somethingWrong: "Oups, une erreur est survenue.",
        checkConnection:
          "Veuillez vérifier votre connexion, désactiver les bloqueurs de publicités ou essayer un autre navigateur.",
        cookiesDisabled:
          "Il semble que les cookies soient désactivés dans votre navigateur.",
        enableCookies: "Veuillez activer les cookies pour continuer.",
        companyLogoAlt: "Logo de l'entreprise",
        fastlyLogoAlt: "Logo Fastly",
      },
      es: {
        somethingWrong: "Vaya, algo salió mal.",
        checkConnection:
          "Verifique su conexión, desactive los bloqueadores de anuncios o intente usar otro navegador.",
        cookiesDisabled:
          "Parece que las cookies están desactivadas en su navegador.",
        enableCookies: "Habilite las cookies para continuar.",
        companyLogoAlt: "Logo de la empresa",
        fastlyLogoAlt: "Logo de Fastly",
      },
    };
    const langs =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || "en"];
    let loc = "en";
    for (const l of langs) {
      const p = l.split("-")[0].toLowerCase();
      if (tr[p]) {
        loc = p;
        break;
      }
    }
    return (k) => tr[loc][k] || tr.en[k];
  } catch {
    var fallback = {
      somethingWrong: "Oops, something went wrong.",
      checkConnection:
        "Please check your connection, disable any ad blockers, or try using a different browser.",
      cookiesDisabled: "It looks like cookies are disabled in your browser.",
      enableCookies: "Please enable cookies to continue.",
      companyLogoAlt: "Company Logo",
      fastlyLogoAlt: "Fastly Logo",
    };
    return (k) => fallback[k] || k;
  }
})();

async function handleScriptError() {
  const errorSpan = document.createElement("span");
  errorSpan.classList.add("error-span");

  const errorText = document.createElement("p");

  // First check if cookies are enabled, returns general error message if true.
  // If false, returns cookie-specific error message.
  if (areCookiesEnabled()) {
    errorSpan.textContent = _t("somethingWrong");
    errorText.textContent = _t("checkConnection");
  } else {
    errorSpan.textContent = _t("cookiesDisabled");
    errorText.textContent = _t("enableCookies");
  }

  const errorTextContainer = document.createElement("div");
  errorTextContainer.classList.add("error-text-container");
  errorTextContainer.setAttribute("role", "alert");
  errorTextContainer.setAttribute("aria-live", "polite");

  const errorScriptPage = document.createElement("div");
  errorScriptPage.classList.add("error-page");

  const errorScriptContainer = document.createElement("div");
  errorScriptContainer.classList.add("error-container");

  const fastlyLogo = await fetchAndCreateLogo();

  const errorIcon = document.createElement("img");
  errorIcon.src = `${_errorsBasePath}/assets/errorIcon.svg`;
  errorIcon.alt = "";
  errorIcon.setAttribute("role", "presentation");
  errorIcon.classList.add("errorIcon");

  errorTextContainer.appendChild(errorIcon);
  errorTextContainer.appendChild(errorSpan);

  errorScriptContainer.appendChild(fastlyLogo);
  errorScriptContainer.appendChild(errorTextContainer);
  errorScriptContainer.appendChild(errorText);

  errorScriptPage.appendChild(errorScriptContainer);
  document.body.appendChild(errorScriptPage);
}

// Tests if cookies are enabled, returns a bool.
function areCookiesEnabled() {
  document.cookie = "testcookie=1; max-age=1; SameSite=Strict";

  const cookiesEnabled = document.cookie.indexOf("testcookie") !== -1;

  return cookiesEnabled;
}

async function fetchAndCreateLogo() {
  const logoUrl = `${window.location.origin}/fastly/logo`;
  let fastlysvg = `${_errorsBasePath}/assets/fastlyLogoError.svg`;
  let logoSrc = fastlysvg;
  let isFetchSuccessful = false;

  try {
    const response = await fetch(logoUrl);
    const contentType = response.headers.get("content-type");
    if (response.ok && contentType.startsWith("image/")) {
      logoSrc = logoUrl;
      isFetchSuccessful = true;
    } else {
      logoSrc = fastlysvg;
    }
  } catch {
    logoSrc = fastlysvg;
  }

  const fastlyLogo = document.createElement("img");
  fastlyLogo.src = logoSrc;
  fastlyLogo.id = "fastlyLogo";
  fastlyLogo.alt = isFetchSuccessful
    ? _t("companyLogoAlt")
    : _t("fastlyLogoAlt");

  if (isFetchSuccessful) {
    fastlyLogo.style.display = "block";
    fastlyLogo.style.width = "auto";
    fastlyLogo.style.height = "75px";
    fastlyLogo.style.margin = "0 auto";
  } else {
    fastlyLogo.style.display = "block";
    fastlyLogo.style.height = "40px";
  }

  return fastlyLogo;
}
