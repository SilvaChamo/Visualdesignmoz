'use client'

import { supabase } from './supabase'

// ── Websites ────────────────────────────────────────────────────────────────

export async function syncWebsiteToSupabase(website: {
  domain: string
  adminEmail?: string
  package?: string
  owner?: string
  status?: string
  diskUsage?: string
  bandwidthUsage?: string
  wpInstalled?: boolean
}) {
  try {
    const payload = {
      domain: website.domain,
      admin_email: website.adminEmail || '',
      package: website.package || 'Default',
      owner: website.owner || 'admin',
      status: website.status || 'Active',
      disk_usage: website.diskUsage || '0',
      bandwidth_usage: website.bandwidthUsage || '0',
      wp_installed: website.wpInstalled ?? false,
      synced_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase.from('cyberpanel_sites').select('id').eq('domain', website.domain).single()
    if (existing) {
      await supabase.from('cyberpanel_sites').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('cyberpanel_sites').insert([payload])
    }
  } catch (e) {
    console.warn('[supabase-sync] syncWebsiteToSupabase error:', e)
  }
}

export async function removeWebsiteFromSupabase(domain: string) {
  try {
    await supabase.from('cyberpanel_sites').delete().eq('domain', domain)
  } catch (e) {
    console.warn('[supabase-sync] removeWebsiteFromSupabase error:', e)
  }
}

export async function markWPInstalledInSupabase(domain: string) {
  try {
    await supabase
      .from('cyberpanel_sites')
      .update({ wp_installed: true, synced_at: new Date().toISOString() })
      .eq('domain', domain)
  } catch (e) {
    console.warn('[supabase-sync] markWPInstalledInSupabase error:', e)
  }
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function syncUserToSupabase(user: {
  username: string
  firstName?: string
  lastName?: string
  email?: string
  acl?: string
  websitesLimit?: number
  emailsLimit?: number
  status?: string
}) {
  try {
    const payload = {
      username: user.username,
      first_name: user.firstName || '',
      last_name: user.lastName || '',
      email: user.email || '',
      acl: user.acl || 'user',
      websites_limit: user.websitesLimit ?? 0,
      emails_limit: user.emailsLimit ?? 0,
      status: user.status || 'Active',
      synced_at: new Date().toISOString(),
    }

    // Check if user exists first to replace `upsert` which requires a UNIQUE constraint on `username` that might be missing
    const { data: existing } = await supabase.from('cyberpanel_users').select('id').eq('username', user.username).single()
    
    if (existing) {
      await supabase.from('cyberpanel_users').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('cyberpanel_users').insert([payload])
    }
  } catch (e) {
    console.warn('[supabase-sync] syncUserToSupabase error:', e)
  }
}

export async function getUsersFromSupabase() {
  try {
    const { data, error } = await supabase.from('cyberpanel_users').select('*')
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('[supabase-sync] getUsersFromSupabase error:', e)
    return []
  }
}

export async function removeUserFromSupabase(username: string) {
  try {
    await supabase.from('cyberpanel_users').delete().eq('username', username)
  } catch (e) {
    console.warn('[supabase-sync] removeUserFromSupabase error:', e)
  }
}

export async function syncUsersToSupabase(users: Array<{
  userName: string
  firstName?: string
  lastName?: string
  email?: string
  acl?: string
  websitesLimit?: number
  status?: string
}>) {
  for (const user of users) {
    await syncUserToSupabase({
      username: user.userName,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      acl: user.acl,
      websitesLimit: user.websitesLimit,
      status: user.status,
    })
  }
}

// ── Packages ─────────────────────────────────────────────────────────────────

export async function syncPackageToSupabase(pkg: {
  packageName: string
  diskSpace?: number
  bandwidth?: number
  emailAccounts?: number
  dataBases?: number
  ftpAccounts?: number
  allowedDomains?: number
}) {
  try {
    const payload = {
      package_name: pkg.packageName,
      disk_space: pkg.diskSpace ?? 1000,
      bandwidth: pkg.bandwidth ?? 1000,
      email_accounts: pkg.emailAccounts ?? 10,
      databases: pkg.dataBases ?? 5,
      ftp_accounts: pkg.ftpAccounts ?? 5,
      allowed_domains: pkg.allowedDomains ?? 1,
      synced_at: new Date().toISOString(),
    }
    const { data: existing } = await supabase.from('cyberpanel_packages').select('id').eq('package_name', pkg.packageName).single()
    if (existing) {
      const { error } = await supabase.from('cyberpanel_packages').update(payload).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('cyberpanel_packages').insert([payload])
      if (error) throw error
    }
  } catch (e) {
    console.warn('[supabase-sync] syncPackageToSupabase error:', e)
  }
}

export async function removePackageFromSupabase(packageName: string) {
  try {
    const { error } = await supabase.from('cyberpanel_packages').delete().eq('package_name', packageName)
    if (error) throw error
  } catch (e) {
    console.warn('[supabase-sync] removePackageFromSupabase error:', e)
  }
}
