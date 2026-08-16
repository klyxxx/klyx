export type KlyxCurrencyFamily =
  | "euro"
  | "dollar";

export type KlyxMarketKind =
  | "country"
  | "territory";

export type KlyxCurrencyUsage =
  | "official"
  | "official-shared"
  | "de-facto";

export type KlyxSupportedMarket = {
  countryCode: string;
  countryName: string;
  kind: KlyxMarketKind;

  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  currencyFamily: KlyxCurrencyFamily;

  usage: KlyxCurrencyUsage;
};

/**
 * KLYX_SUPPORTED_MARKETS_14_19
 *
 * Marchés KLYX utilisant :
 * - l'euro ;
 * - USD ;
 * - ou une monnaie officielle appartenant à la famille "dollar".
 *
 * IMPORTANT :
 * Le symbole "$" ne signifie PAS automatiquement USD.
 *
 * Exemple :
 * Canada    -> CAD
 * Australie -> AUD
 * Singapour -> SGD
 * Hong Kong -> HKD
 */

// ============================================================
// EURO
// ============================================================

export const KLYX_EURO_MARKETS = [
  {
    countryCode: "AT",
    countryName: "Autriche",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "BE",
    countryName: "Belgique",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "BG",
    countryName: "Bulgarie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "HR",
    countryName: "Croatie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "CY",
    countryName: "Chypre",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "EE",
    countryName: "Estonie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "FI",
    countryName: "Finlande",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "FR",
    countryName: "France",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "DE",
    countryName: "Allemagne",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "GR",
    countryName: "Grèce",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "IE",
    countryName: "Irlande",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "IT",
    countryName: "Italie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "LV",
    countryName: "Lettonie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "LT",
    countryName: "Lituanie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "LU",
    countryName: "Luxembourg",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "MT",
    countryName: "Malte",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "NL",
    countryName: "Pays-Bas",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "PT",
    countryName: "Portugal",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "SK",
    countryName: "Slovaquie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "SI",
    countryName: "Slovénie",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "ES",
    countryName: "Espagne",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },

  // ------------------------------------------------------------
  // États hors UE utilisant officiellement l'euro
  // ------------------------------------------------------------

  {
    countryCode: "AD",
    countryName: "Andorre",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "MC",
    countryName: "Monaco",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "SM",
    countryName: "Saint-Marin",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "VA",
    countryName: "Vatican",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },

  // ------------------------------------------------------------
  // Utilisation de facto
  // ------------------------------------------------------------

  {
    countryCode: "ME",
    countryName: "Monténégro",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "de-facto",
  },
  {
    countryCode: "XK",
    countryName: "Kosovo",
    kind: "country",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "de-facto",
  },

  // ------------------------------------------------------------
  // Territoires utilisant l'euro
  // ------------------------------------------------------------

  {
    countryCode: "AX",
    countryName: "Îles Åland",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "GF",
    countryName: "Guyane française",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "GP",
    countryName: "Guadeloupe",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "MQ",
    countryName: "Martinique",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "YT",
    countryName: "Mayotte",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "RE",
    countryName: "La Réunion",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "BL",
    countryName: "Saint-Barthélemy",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "MF",
    countryName: "Saint-Martin",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "PM",
    countryName: "Saint-Pierre-et-Miquelon",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
  {
    countryCode: "TF",
    countryName: "Terres australes françaises",
    kind: "territory",
    currencyCode: "EUR",
    currencyName: "Euro",
    currencySymbol: "€",
    currencyFamily: "euro",
    usage: "official",
  },
] as const satisfies readonly KlyxSupportedMarket[];

// ============================================================
// DOLLARS
// ============================================================

export const KLYX_DOLLAR_MARKETS = [
  // ============================================================
  // USD
  // ============================================================

  {
    countryCode: "US",
    countryName: "États-Unis",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "EC",
    countryName: "Équateur",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "SV",
    countryName: "Salvador",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "PA",
    countryName: "Panama",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official-shared",
  },
  {
    countryCode: "TL",
    countryName: "Timor oriental",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "MH",
    countryName: "Îles Marshall",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "FM",
    countryName: "Micronésie",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "PW",
    countryName: "Palaos",
    kind: "country",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // USD territories

  {
    countryCode: "AS",
    countryName: "Samoa américaines",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BQ",
    countryName: "Bonaire, Saint-Eustache et Saba",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "VG",
    countryName: "Îles Vierges britanniques",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "TC",
    countryName: "Îles Turques-et-Caïques",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "PR",
    countryName: "Porto Rico",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "GU",
    countryName: "Guam",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "VI",
    countryName: "Îles Vierges des États-Unis",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "MP",
    countryName: "Îles Mariannes du Nord",
    kind: "territory",
    currencyCode: "USD",
    currencyName: "Dollar des États-Unis",
    currencySymbol: "$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // CAD
  // ============================================================

  {
    countryCode: "CA",
    countryName: "Canada",
    kind: "country",
    currencyCode: "CAD",
    currencyName: "Dollar canadien",
    currencySymbol: "CA$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // AUD
  // ============================================================

  {
    countryCode: "AU",
    countryName: "Australie",
    kind: "country",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "KI",
    countryName: "Kiribati",
    kind: "country",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "NR",
    countryName: "Nauru",
    kind: "country",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "TV",
    countryName: "Tuvalu",
    kind: "country",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "CX",
    countryName: "Île Christmas",
    kind: "territory",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "CC",
    countryName: "Îles Cocos",
    kind: "territory",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "NF",
    countryName: "Île Norfolk",
    kind: "territory",
    currencyCode: "AUD",
    currencyName: "Dollar australien",
    currencySymbol: "A$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // NZD
  // ============================================================

  {
    countryCode: "NZ",
    countryName: "Nouvelle-Zélande",
    kind: "country",
    currencyCode: "NZD",
    currencyName: "Dollar néo-zélandais",
    currencySymbol: "NZ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "CK",
    countryName: "Îles Cook",
    kind: "territory",
    currencyCode: "NZD",
    currencyName: "Dollar néo-zélandais",
    currencySymbol: "NZ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "NU",
    countryName: "Niue",
    kind: "territory",
    currencyCode: "NZD",
    currencyName: "Dollar néo-zélandais",
    currencySymbol: "NZ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "TK",
    countryName: "Tokelau",
    kind: "territory",
    currencyCode: "NZD",
    currencyName: "Dollar néo-zélandais",
    currencySymbol: "NZ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "PN",
    countryName: "Îles Pitcairn",
    kind: "territory",
    currencyCode: "NZD",
    currencyName: "Dollar néo-zélandais",
    currencySymbol: "NZ$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // AUTRES DOLLARS
  // ============================================================

  {
    countryCode: "SG",
    countryName: "Singapour",
    kind: "country",
    currencyCode: "SGD",
    currencyName: "Dollar de Singapour",
    currencySymbol: "S$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "HK",
    countryName: "Hong Kong",
    kind: "territory",
    currencyCode: "HKD",
    currencyName: "Dollar de Hong Kong",
    currencySymbol: "HK$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BN",
    countryName: "Brunei",
    kind: "country",
    currencyCode: "BND",
    currencyName: "Dollar de Brunei",
    currencySymbol: "B$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "TW",
    countryName: "Taïwan",
    kind: "country",
    currencyCode: "TWD",
    currencyName: "Nouveau dollar de Taïwan",
    currencySymbol: "NT$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "FJ",
    countryName: "Fidji",
    kind: "country",
    currencyCode: "FJD",
    currencyName: "Dollar fidjien",
    currencySymbol: "FJ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "SB",
    countryName: "Îles Salomon",
    kind: "country",
    currencyCode: "SBD",
    currencyName: "Dollar des Îles Salomon",
    currencySymbol: "SI$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "NA",
    countryName: "Namibie",
    kind: "country",
    currencyCode: "NAD",
    currencyName: "Dollar namibien",
    currencySymbol: "N$",
    currencyFamily: "dollar",
    usage: "official-shared",
  },
  {
    countryCode: "LR",
    countryName: "Liberia",
    kind: "country",
    currencyCode: "LRD",
    currencyName: "Dollar libérien",
    currencySymbol: "L$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BZ",
    countryName: "Belize",
    kind: "country",
    currencyCode: "BZD",
    currencyName: "Dollar bélizien",
    currencySymbol: "BZ$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "GY",
    countryName: "Guyana",
    kind: "country",
    currencyCode: "GYD",
    currencyName: "Dollar guyanien",
    currencySymbol: "G$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "JM",
    countryName: "Jamaïque",
    kind: "country",
    currencyCode: "JMD",
    currencyName: "Dollar jamaïcain",
    currencySymbol: "J$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BS",
    countryName: "Bahamas",
    kind: "country",
    currencyCode: "BSD",
    currencyName: "Dollar bahaméen",
    currencySymbol: "B$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BB",
    countryName: "Barbade",
    kind: "country",
    currencyCode: "BBD",
    currencyName: "Dollar barbadien",
    currencySymbol: "Bds$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "TT",
    countryName: "Trinité-et-Tobago",
    kind: "country",
    currencyCode: "TTD",
    currencyName: "Dollar de Trinité-et-Tobago",
    currencySymbol: "TT$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "SR",
    countryName: "Suriname",
    kind: "country",
    currencyCode: "SRD",
    currencyName: "Dollar surinamais",
    currencySymbol: "SRD",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // XCD - Dollar des Caraïbes orientales
  // ============================================================

  {
    countryCode: "AG",
    countryName: "Antigua-et-Barbuda",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "DM",
    countryName: "Dominique",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "GD",
    countryName: "Grenade",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "KN",
    countryName: "Saint-Christophe-et-Niévès",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "LC",
    countryName: "Sainte-Lucie",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "VC",
    countryName: "Saint-Vincent-et-les-Grenadines",
    kind: "country",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "AI",
    countryName: "Anguilla",
    kind: "territory",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "MS",
    countryName: "Montserrat",
    kind: "territory",
    currencyCode: "XCD",
    currencyName: "Dollar des Caraïbes orientales",
    currencySymbol: "EC$",
    currencyFamily: "dollar",
    usage: "official",
  },

  // ============================================================
  // KYD / BMD
  // ============================================================

  {
    countryCode: "KY",
    countryName: "Îles Caïmans",
    kind: "territory",
    currencyCode: "KYD",
    currencyName: "Dollar des îles Caïmans",
    currencySymbol: "CI$",
    currencyFamily: "dollar",
    usage: "official",
  },
  {
    countryCode: "BM",
    countryName: "Bermudes",
    kind: "territory",
    currencyCode: "BMD",
    currencyName: "Dollar bermudien",
    currencySymbol: "BD$",
    currencyFamily: "dollar",
    usage: "official",
  },
] as const satisfies readonly KlyxSupportedMarket[];

// ============================================================
// MERGED KLYX MARKETS
// ============================================================

// KLYX_EURO_DOLLAR_GLOBAL_MARKETS_14_19
export const KLYX_SUPPORTED_MARKETS:
  readonly KlyxSupportedMarket[] = [
    ...KLYX_EURO_MARKETS,
    ...KLYX_DOLLAR_MARKETS,
  ];

export const KLYX_SUPPORTED_COUNTRIES =
  KLYX_SUPPORTED_MARKETS.filter(
    (market) =>
      market.kind === "country"
  );

export const KLYX_SUPPORTED_TERRITORIES =
  KLYX_SUPPORTED_MARKETS.filter(
    (market) =>
      market.kind === "territory"
  );

export const KLYX_SUPPORTED_CURRENCY_CODES =
  Array.from(
    new Set(
      KLYX_SUPPORTED_MARKETS.map(
        (market) =>
          market.currencyCode
      )
    )
  ).sort();

export function getKlyxMarket(
  countryCode: string
): KlyxSupportedMarket | null {
  const normalized =
    countryCode.trim().toUpperCase();

  return (
    KLYX_SUPPORTED_MARKETS.find(
      (market) =>
        market.countryCode ===
        normalized
    ) ?? null
  );
}

export function getKlyxCurrencyForCountry(
  countryCode: string
): {
  code: string;
  name: string;
  symbol: string;
  family: KlyxCurrencyFamily;
} | null {
  const market =
    getKlyxMarket(countryCode);

  if (!market) {
    return null;
  }

  return {
    code: market.currencyCode,
    name: market.currencyName,
    symbol: market.currencySymbol,
    family: market.currencyFamily,
  };
}

function normalizeMarketSearch(
  value: string
) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}

export function searchKlyxMarkets(
  query: string
): KlyxSupportedMarket[] {
  const normalizedQuery =
    normalizeMarketSearch(query);

  if (!normalizedQuery) {
    return [...KLYX_SUPPORTED_MARKETS];
  }

  return KLYX_SUPPORTED_MARKETS.filter(
    (market) => {
      const haystack =
        normalizeMarketSearch(
          [
            market.countryName,
            market.countryCode,
            market.currencyCode,
            market.currencyName,
            market.currencySymbol,
          ].join(" ")
        );

      return haystack.includes(
        normalizedQuery
      );
    }
  );
}

export function isKlyxSupportedCountry(
  countryCode: string
) {
  return (
    getKlyxMarket(countryCode) !== null
  );
}

export function formatKlyxMoney(
  amount: number,
  countryCode: string,
  locale = "fr-BE"
) {
  const market =
    getKlyxMarket(countryCode);

  if (!market) {
    return amount.toFixed(2);
  }

  return new Intl.NumberFormat(
    locale,
    {
      style: "currency",
      currency:
        market.currencyCode,
    }
  ).format(amount);
}

// Stripe utilise généralement le code ISO en minuscules.
export function getKlyxPaymentCurrency(
  countryCode: string
): string | null {
  const market =
    getKlyxMarket(countryCode);

  return market
    ? market.currencyCode.toLowerCase()
    : null;
}

// KLYX_MARKETS_EUR_DOLLAR_READY_14_19
export const KLYX_MARKETS_EUR_DOLLAR_READY =
  true;