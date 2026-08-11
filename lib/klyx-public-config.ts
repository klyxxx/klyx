export const KLYX_PUBLIC_CONFIG = {
  name: "KLYX",
  supportEmail:
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() ||
    "klyxsupport@gmail.com",
  legalName:
    process.env.NEXT_PUBLIC_KLYX_LEGAL_NAME?.trim() ||
    "KLYX",
  legalAddress:
    process.env.NEXT_PUBLIC_KLYX_LEGAL_ADDRESS?.trim() ||
    "",
  companyNumber:
    process.env.NEXT_PUBLIC_KLYX_COMPANY_NUMBER?.trim() ||
    "",
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://klyx-ten.vercel.app",
} as const;
