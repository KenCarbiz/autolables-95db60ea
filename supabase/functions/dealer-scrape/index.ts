const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let formattedUrl = url.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`
    }

    console.log('Scraping dealer URL:', formattedUrl)

    const browserHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }

    // Try the URL as-is, then with/without www
    const urlsToTry = [formattedUrl]
    try {
      const parsed = new URL(formattedUrl)
      if (parsed.hostname.startsWith('www.')) {
        urlsToTry.push(formattedUrl.replace('://www.', '://'))
      } else {
        urlsToTry.push(formattedUrl.replace('://', '://www.'))
      }
    } catch { /* ignore */ }

    let html = ''
    let finalUrl = formattedUrl
    let lastError = ''

    for (const tryUrl of urlsToTry) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)

      try {
        const res = await fetch(tryUrl, {
          signal: controller.signal,
          headers: browserHeaders,
          redirect: 'follow',
        })
        clearTimeout(timeout)

        if (res.ok) {
          const text = await res.text()
          if (text.length > 500) {
            html = text
            finalUrl = tryUrl
            break
          } else {
            lastError = 'Page returned very little content'
          }
        } else {
          lastError = `Site returned ${res.status}`
          // Consume body to avoid leak
          await res.text()
        }
      } catch (fetchErr) {
        clearTimeout(timeout)
        lastError = fetchErr instanceof Error ? fetchErr.message : 'Fetch failed'
      }
    }

    if (!html) {
      return new Response(
        JSON.stringify({ success: false, error: lastError || 'Could not fetch dealer website' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Fetched ${html.length} chars from ${finalUrl}`)

    return new Response(
      JSON.stringify({ success: true, html, sourceUrl: finalUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
