import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Créneaux et leur heure de début en minutes depuis minuit
const SLOT_STARTS: Record<string, number> = {
  '08h-12h': 8 * 60,
  '14h-18h': 14 * 60,
}

Deno.serve(async () => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Heure actuelle en heure de Paris (gère UTC+1 hiver / UTC+2 été automatiquement)
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const nowMin = parseInt(parts.hour) * 60 + parseInt(parts.minute)

  // Charger les opérateurs avec leur numéro et clé API CallMeBot
  const { data: ops, error: opsErr } = await sb.from('operateurs').select('name, phone, apikey')
  if (opsErr) return new Response(JSON.stringify({ error: opsErr.message }), { status: 500 })

  const opMap: Record<string, { phone: string; apikey: string }> =
    Object.fromEntries((ops || []).map((o: any) => [o.name, o]))

  const notified: string[] = []

  for (const [slot, slotMin] of Object.entries(SLOT_STARTS)) {
    const diff = slotMin - nowMin

    // Exactement 20 minutes avant le début du créneau (1 seul envoi)
    if (diff !== 20) continue

    const { data: bookings, error: bookErr } = await sb
      .from('bookings')
      .select('machine, nom, prenom, operateur, projet')
      .eq('date', today)
      .eq('slot', slot)

    if (bookErr) continue

    for (const b of (bookings || []) as any[]) {
      const op = opMap[b.operateur]
      if (!op?.phone || !op?.apikey) continue

      const msg =
        `Rappel : votre créneau ${slot} sur ${b.machine} commence dans 20 min. ` +
        `Réservé par ${b.nom} ${b.prenom} (${b.projet}).`

      const url =
        `https://api.callmebot.com/whatsapp.php` +
        `?phone=${encodeURIComponent(op.phone)}` +
        `&text=${encodeURIComponent(msg)}` +
        `&apikey=${encodeURIComponent(op.apikey)}`

      await fetch(url)
      notified.push(`${b.machine} / ${slot} → ${b.operateur}`)
    }
  }

  return new Response(JSON.stringify({ ok: true, heureParis: `${parts.hour}:${parts.minute}`, notified }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
