$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ""
Write-Host "KLYX 12.7 - SEARCH & BOOKING UX" -ForegroundColor Cyan
Write-Host ""

$searchPath = Join-Path $root "app\search\page.tsx"
$bookingPath = Join-Path $root "app\providers\[id]\book\page.tsx"

foreach ($path in @($searchPath, $bookingPath)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Fichier introuvable : $path"
  }
}

# Sauvegardes locales, jamais a committer.
if (-not (Test-Path -LiteralPath "$searchPath.12-7.bak")) {
  Copy-Item -LiteralPath $searchPath -Destination "$searchPath.12-7.bak"
}
if (-not (Test-Path -LiteralPath "$bookingPath.12-7.bak")) {
  Copy-Item -LiteralPath $bookingPath -Destination "$bookingPath.12-7.bak"
}

# -------------------------------------------------------------------
# 1. SEARCH : validation heure debut/fin + UX mobile compacte
# -------------------------------------------------------------------
$search = Get-Content -LiteralPath $searchPath -Raw

# Etat d'ouverture des filtres avances.
if ($search -notmatch 'showAdvancedFilters') {
  $old = @'
  const [reloadKey, setReloadKey] = useState(0);
'@
  $new = @'
  const [reloadKey, setReloadKey] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
'@

  if (-not $search.Contains($old)) {
    throw "SEARCH : point d'insertion showAdvancedFilters introuvable."
  }

  $search = $search.Replace($old, $new)
}

# Validation avant envoi : fin obligatoirement apres debut.
if ($search -notmatch 'L''heure de fin doit être après l''heure de début') {
  $old = @'
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
'@
  $new = @'
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      draft.startTime &&
      draft.endTime &&
      draft.endTime <= draft.startTime
    ) {
      setErrorMessage("L'heure de fin doit être après l'heure de début.");
      return;
    }

    setErrorMessage("");

    const params = new URLSearchParams();
'@

  if (-not $search.Contains($old)) {
    throw "SEARCH : bloc submitSearch introuvable."
  }

  $search = $search.Replace($old, $new)
}

# Sur mobile : 4 criteres essentiels visibles, budget/tarif/tri dans filtres avances.
$oldAdvancedStart = @'
            <FilterField label="Prix maximum" icon={<Euro size={17} />}>
'@

if ($search.Contains($oldAdvancedStart) -and $search -notmatch 'Filtres avancés') {
  $search = $search.Replace(
    $oldAdvancedStart,
@'
            <div className="md:col-span-2 xl:col-span-4">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-semibold text-zinc-300 hover:border-zinc-700"
                aria-expanded={showAdvancedFilters}
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={17} />
                  Filtres avancés
                </span>
                <span className="text-zinc-500">
                  {showAdvancedFilters ? "Masquer" : "Afficher"}
                </span>
              </button>
            </div>

            <div
              className={`grid gap-4 md:col-span-2 md:grid-cols-2 xl:col-span-4 xl:grid-cols-3 ${
                showAdvancedFilters ? "grid" : "hidden md:grid"
              }`}
            >
              <FilterField label="Prix maximum" icon={<Euro size={17} />}>
'@
  )

  $oldAdvancedEnd = @'
            <FilterField label="Trier par" icon={<ShieldCheck size={17} />}>
              <KlyxSelect
                value={draft.sort}
                onChange={(value) =>
                  updateDraft("sort", value as ProviderSearchSort)
                }
                options={SORT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                ariaLabel="Trier par"
              />
            </FilterField>
'@

  $newAdvancedEnd = @'
              <FilterField label="Trier par" icon={<ShieldCheck size={17} />}>
                <KlyxSelect
                  value={draft.sort}
                  onChange={(value) =>
                    updateDraft("sort", value as ProviderSearchSort)
                  }
                  options={SORT_OPTIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  ariaLabel="Trier par"
                />
              </FilterField>
            </div>
'@

  if (-not $search.Contains($oldAdvancedEnd)) {
    throw "SEARCH : fin du bloc filtres avances introuvable."
  }

  $search = $search.Replace($oldAdvancedEnd, $newAdvancedEnd)
}

# Les resumes prenaient trop de hauteur sur telephone.
$search = $search.Replace(
  '        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">',
  '        <section className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">'
)

[System.IO.File]::WriteAllText(
  $searchPath,
  $search,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Recherche mobile simplifiee." -ForegroundColor Green
Write-Host "[OK] Heures debut/fin validees." -ForegroundColor Green

# -------------------------------------------------------------------
# 2. BOOKING : corrige le passage start/end depuis /search
# -------------------------------------------------------------------
$booking = Get-Content -LiteralPath $bookingPath -Raw

$oldBookingParams = @'
  const requestedDate = validRequestedDate(searchParams.get("date"));
  const requestedTime = validRequestedTime(searchParams.get("time"));
  const requestedEndTime = endTimeFromRequest(
    requestedTime,
    searchParams.get("duration")
  );
'@

$newBookingParams = @'
  const requestedDate = validRequestedDate(searchParams.get("date"));
  const requestedTime = validRequestedTime(
    searchParams.get("start") ?? searchParams.get("time")
  );
  const requestedExplicitEndTime = validRequestedTime(searchParams.get("end"));
  const requestedEndTime =
    requestedExplicitEndTime ||
    endTimeFromRequest(requestedTime, searchParams.get("duration"));
'@

if ($booking.Contains($oldBookingParams)) {
  $booking = $booking.Replace($oldBookingParams, $newBookingParams)
  Write-Host "[OK] Search -> Booking transmet maintenant debut ET fin." -ForegroundColor Green
}
elseif ($booking -match 'searchParams\.get\("start"\)' -and $booking -match 'searchParams\.get\("end"\)') {
  Write-Host "[OK] Passage start/end deja corrige." -ForegroundColor Green
}
else {
  throw "BOOKING : bloc des parametres horaires introuvable."
}

# Validation client avant appel API.
if ($booking -notmatch 'Le créneau choisi n''est pas valide') {
  $old = @'
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
'@

  $new = @'
    try {
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (
        !bookingDate ||
        startMinutes === null ||
        endMinutes === null ||
        endMinutes <= startMinutes
      ) {
        throw new Error(
          "Le créneau choisi n'est pas valide. Vérifie la date, l'heure de début et l'heure de fin."
        );
      }

      if (selectedDayAvailability.length === 0) {
        throw new Error(
          "Le prestataire n'a déclaré aucune disponibilité pour ce jour."
        );
      }

      const fitsAvailability = selectedDayAvailability.some((slot) => {
        const slotStart = timeToMinutes(slot.start_time.slice(0, 5));
        const slotEnd = timeToMinutes(slot.end_time.slice(0, 5));

        return (
          slotStart !== null &&
          slotEnd !== null &&
          startMinutes >= slotStart &&
          endMinutes <= slotEnd
        );
      });

      if (!fitsAvailability) {
        throw new Error(
          "Ce créneau est en dehors des horaires déclarés par le prestataire."
        );
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
'@

  if (-not $booking.Contains($old)) {
    throw "BOOKING : bloc handleSubmit introuvable."
  }

  $booking = $booking.Replace($old, $new)
}

# Mobile : moins de padding et image moins haute.
$booking = $booking.Replace(
  '    <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white">',
  '    <main className="min-h-screen overflow-x-hidden bg-zinc-950 px-3 py-5 text-white sm:px-5 sm:py-8">'
)
$booking = $booking.Replace(
  '          <div className="flex min-h-72 items-center justify-center bg-zinc-800">',
  '          <div className="flex min-h-52 items-center justify-center bg-zinc-800 sm:min-h-72">'
)
$booking = $booking.Replace(
  '                className="h-full min-h-72 w-full object-cover"',
  '                className="h-full min-h-52 w-full object-cover sm:min-h-72"'
)

[System.IO.File]::WriteAllText(
  $bookingPath,
  $booking,
  [System.Text.UTF8Encoding]::new($false)
)

Write-Host "[OK] Reservation valide le creneau avant envoi." -ForegroundColor Green
Write-Host "[OK] Mise en page reservation allegee sur mobile." -ForegroundColor Green
Write-Host ""
Write-Host "12.7 appliquee sans modification Supabase." -ForegroundColor Cyan
