import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
    const { data, error } = await supabaseAdmin
        .from('email_campaigns')
        .select('*, content_html, sender_email, target_audiences, total_recipients, successful_sends, failed_sends')
        .order('created_at', { ascending: false });
        
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { subject, content_html, send_now } = body;
        
        if (!subject || !content_html) {
            return NextResponse.json({ error: 'Subject and Content are required' }, { status: 400 });
        }
        
        // 1. Create campaign record
        const { data: campaign, error: campaignError } = await supabaseAdmin
            .from('email_campaigns')
            .insert({
                subject,
                content_html,
                status: send_now ? 'sent' : 'draft',
                sender_email: body.sender_email || 'admin@your-domain.com',
                target_audiences: body.target_audiences || [],
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 });
        
        if (send_now) {
            // 2. Fetch all active subscribers
            const { data: subscribers, error: subError } = await supabaseAdmin
                .from('newsletter_subscribers')
                .select('*')
                .eq('status', 'subscribed');
                
            if (subError) {
                await supabaseAdmin.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
                return NextResponse.json({ error: subError.message }, { status: 500 });
            }
            
            // 3. Send emails (for simplicity, we send them sequentially here, but ideally this would be a background job)
            let successCount = 0;
            let failCount = 0;
            
            for (const sub of subscribers) {
                try {
                    await sendEmail({
                        to: sub.email,
                        subject: subject,
                        html: content_html
                    });
                    
                    await supabaseAdmin.from('email_campaign_logs').insert({
                        campaign_id: campaign.id,
                        subscriber_id: sub.id,
                        status: 'delivered'
                    });
                    successCount++;
                } catch (err: any) {
                    await supabaseAdmin.from('email_campaign_logs').insert({
                        campaign_id: campaign.id,
                        subscriber_id: sub.id,
                        status: 'failed',
                        error_message: err.message
                    });
                    failCount++;
                }
            }
            
            // 4. Update campaign status
            await supabaseAdmin.from('email_campaigns').update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                total_recipients: subscribers.length,
                successful_sends: successCount,
                failed_sends: failCount
            }).eq('id', campaign.id);
            
            return NextResponse.json({ 
                success: true, 
                campaign_id: campaign.id,
                stats: { total: subscribers.length, success: successCount, fail: failCount }
            });
        }
        
        return NextResponse.json(campaign);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
