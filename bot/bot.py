# python-telegram-bot >= 20 example that opens a Mini App & receives WebAppData
import os
import json
import logging
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, ReplyKeyboardRemove, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("miniapp")

BOT_TOKEN = os.environ.get("BOT_TOKEN", "PUT-YOUR-TOKEN-HERE")
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://your-domain.example/web/index.html")  # must be https

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    kb = ReplyKeyboardMarkup.from_button(
        KeyboardButton(
            text="Open spreadsheet",
            web_app=WebAppInfo(url=WEBAPP_URL),
        )
    )
    await update.message.reply_text(
        "Tap to open the Mini App, pick rows, then press “Send” to return data here.",
        reply_markup=kb,
    )

async def handle_web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    # Web App sends a JSON string via WebApp.sendData(...)
    try:
        payload = json.loads(update.effective_message.web_app_data.data)
    except Exception:
        payload = {"raw": update.effective_message.web_app_data.data}

    count = payload.get("count") or len(payload.get("rows", []))
    rows = payload.get("rows", [])[:5]  # preview up to 5
    preview = "\n".join([f"• #{r['id']} {r['item']} x{r['qty']} = ${r['total']:.2f}" for r in rows])
    await update.message.reply_html(
        f"<b>Got {count} row(s)</b>\n{preview}",
        reply_markup=ReplyKeyboardRemove(),
    )

def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_web_app_data))
    app.run_polling()

if __name__ == "__main__":
    main()
