// Edge Function : notify-print
// Envoie une notification WhatsApp aux opérateurs CÔTÉ SERVEUR (leurs numéros/clés API ne sont
// plus exposés au navigateur). Le client fournit juste le message déjà rédigé (il ne contient
// aucune donnée sensible). La cible respecte le paramètre `operateurs_impression`.
// Entrée POST JSON : { message } -> { ok, count }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { message } = await req.json()
    if (!message) return new Response(JSON.stringify({ ok: false, error: 'no message' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Liste d'opérateurs à notifier (null = tous ceux qui ont un WhatsApp configuré)
    let notif: string[] | null = null
    const { data: p } = await sb.from('parametres').select('valeur').eq('cle', 'operateurs_impression').maybeSingle()
    try { const a = JSON.parse(p?.valeur || 'null'); if (Array.isArray(a)) notif = a } catch (_) { /* laisse null */ }

    const { data: ops } = await sb.from('operateurs').select('name, phone, apikey')
    const cibles = (ops || []).filter((o: any) =>
      o.phone && o.apikey && (notif === null || notif.includes(o.name)))

    let count = 0
    for (const o of cibles as any[]) {
      const url = `https://api.callmebot.com/whatsapp.php` +
        `?phone=${encodeURIComponent(o.phone)}` +
        `&text=${encodeURIComponent(message)}` +
        `&apikey=${encodeURIComponent(o.apikey)}`
      try { await fetch(url); count++ } catch (_) { /* ignore un envoi raté */ }
    }

    return new Response(JSON.stringify({ ok: true, count }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
