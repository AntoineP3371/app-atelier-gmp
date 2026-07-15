// Edge Function : admin-operators
// Lecture/écriture COMPLÈTE des opérateurs (nom, téléphone, clé API, code), réservée à l'admin.
// Le mot de passe admin est vérifié par son empreinte SHA-256, stockée en variable
// d'environnement de la fonction (ADMIN_PW_HASH) — jamais dans le code client.
// Entrée POST JSON :
//   { action:'list', adminCode }                -> { ok, operators:[...] }
//   { action:'save', adminCode, operators:[...] } -> { ok }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { action, adminCode, operators } = await req.json()

    // Authentification admin (empreinte comparée à la variable d'environnement)
    const expected = (Deno.env.get('ADMIN_PW_HASH') || '').trim()
    const given = await sha256hex((adminCode ?? '').toString())
    if (!expected || given !== expected) return json({ ok: false, error: 'unauthorized' }, 401)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (action === 'list') {
      const { data, error } = await sb
        .from('operateurs')
        .select('name, phone, apikey, code, notif_3d')
        .order('name')
      if (error) throw error
      return json({ ok: true, operators: data || [] })
    }

    if (action === 'save') {
      // Conserver notif_3d (géré côté Impression 3D, pas par ce gestionnaire)
      const backup = (await sb.from('operateurs').select('*')).data || []
      const notifByName: Record<string, boolean> = {}
      for (const o of backup as any[]) notifByName[o.name] = o.notif_3d
      const rows = ((operators || []) as any[])
        .filter((o) => o && (o.name ?? '').toString().trim())
        .map((o) => ({
          name: o.name.toString().trim(),
          phone: (o.phone ?? '').toString().trim(),
          apikey: (o.apikey ?? '').toString().trim(),
          code: (o.code ?? '').toString().trim(),
          notif_3d: notifByName[o.name.toString().trim()] ?? true,
        }))
      const del = await sb.from('operateurs').delete().neq('name', '__never__')
      if (del.error) throw del.error
      if (rows.length) {
        const ins = await sb.from('operateurs').insert(rows)
        if (ins.error) {
          if (backup.length) await sb.from('operateurs').insert(backup) // restauration
          throw ins.error
        }
      }
      return json({ ok: true })
    }

    return json({ ok: false, error: 'bad action' }, 400)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
