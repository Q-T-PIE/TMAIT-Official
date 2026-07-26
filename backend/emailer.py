import os
import asyncio
import logging
import resend
from database import db

logger = logging.getLogger("emailer")


async def notify_reviewers_pending(job: dict):
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        sender = os.environ["SENDER_EMAIL"]
        app_url = os.environ.get("APP_URL", "")
        recipients = []
        async for u in db.users.find({"role": {"$in": ["reviewer", "admin"]}}, {"_id": 0, "email": 1}):
            recipients.append(u["email"])
        test_recipient = os.environ.get("NOTIFY_TEST_RECIPIENT", "").strip()
        if sender.endswith("@resend.dev") and test_recipient:
            recipients = [test_recipient]
        if not recipients:
            return
        html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, sans-serif; background:#0A0A0A; padding:24px;">
          <tr><td>
            <table width="560" cellpadding="0" cellspacing="0" align="center" style="background:#ffffff; border:1px solid #e5e5e5;">
              <tr><td style="background:#0A0A0A; padding:18px 24px;">
                <span style="color:#FF5F15; font-weight:bold; font-size:18px; letter-spacing:1px;">TMAIT</span>
                <span style="color:#a1a1aa; font-size:11px; letter-spacing:2px;"> &nbsp;A.T.O.M &middot; BC TMM 2020</span>
              </td></tr>
              <tr><td style="padding:24px;">
                <p style="font-size:11px; color:#FF5F15; letter-spacing:2px; margin:0 0 8px;">PLAN PENDING REVIEW</p>
                <h2 style="margin:0 0 12px; color:#0A0A0A; font-size:20px;">{job.get('title', '')}</h2>
                <table cellpadding="4" cellspacing="0" style="font-size:13px; color:#3f3f46;">
                  <tr><td style="color:#a1a1aa;">Location</td><td>{job.get('location', '')}</td></tr>
                  <tr><td style="color:#a1a1aa;">Works</td><td>{job.get('works_type', '')}</td></tr>
                  <tr><td style="color:#a1a1aa;">Client</td><td>{job.get('client_name', '')}</td></tr>
                  <tr><td style="color:#a1a1aa;">Model</td><td>{job.get('model_used', '')}</td></tr>
                </table>
                <p style="margin:20px 0 0;">
                  <a href="{app_url}" style="background:#FF5F15; color:#0A0A0A; font-weight:bold; text-decoration:none; padding:12px 22px; font-size:13px; letter-spacing:1px;">OPEN REVIEW WORKSPACE</a>
                </p>
              </td></tr>
              <tr><td style="padding:14px 24px; border-top:1px solid #e5e5e5;">
                <p style="margin:0; font-size:11px; color:#a1a1aa;">A.T.O.M generated a TMM 2020-compliant traffic plan that needs reviewer approval.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>"""
        params = {
            "from": sender,
            "to": recipients,
            "subject": f"TMAIT — Plan pending review: {job.get('title', '')}",
            "html": html,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Reviewer notification sent to {len(recipients)} recipients: {result.get('id')}")
    except Exception as e:
        logger.error(f"Reviewer notification failed (non-blocking): {e}")
