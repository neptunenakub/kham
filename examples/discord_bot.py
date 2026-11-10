"""A Discord bot that finds Thai words: /kham, /khamrhyme, /khamstart, /khamend and /khampattern.

Setup
    1. pip install discord.py
    2. Create an application and bot at https://discord.com/developers/applications and copy its token.
    3. Invite it to your server with the "bot" and "applications.commands" scopes.
    4. Set the token and run:
           DISCORD_TOKEN=your-token python examples/discord_bot.py        (macOS / Linux)
           $env:DISCORD_TOKEN="your-token"; python examples/discord_bot.py  (PowerShell)

Never put the token in this file or commit it.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import discord  # noqa: E402
from discord import app_commands  # noqa: E402

from kham import COMMON, WordFinder  # noqa: E402

wf = WordFinder()
SHOW = 30  # words per reply; Discord messages are capped at 2,000 characters


def reply(title: str, common: bool = True, **query) -> str:
    """The message text for one search. Plain function, so it works without Discord too."""
    found = wf.search(min_familiarity=COMMON if common else 0.0, **query)
    if not found:
        return f"**{title}**\nไม่พบคำที่ตรงเงื่อนไข"
    more = f"\n…และอีก {len(found) - SHOW:,} คำ" if len(found) > SHOW else ""
    return f"**{title}** · {len(found):,} คำ\n{'  '.join(found[:SHOW])}{more}"


client = discord.Client(intents=discord.Intents.default())
tree = app_commands.CommandTree(client)


@tree.command(name="kham", description="หาคำไทยที่มีตัวอักษรเหล่านี้ครบ")
@app_commands.describe(letters="ตัวอักษรไทย เช่น กรน", rare="รวมคำหายากด้วย")
async def kham(interaction: discord.Interaction, letters: str, rare: bool = False):
    await interaction.response.send_message(reply(f"มี {letters}", common=not rare, letters=letters))


@tree.command(name="khamrhyme", description="หาคำไทยที่สัมผัสกับคำนี้")
@app_commands.describe(word="เช่น รัก", rare="รวมคำหายากด้วย")
async def khamrhyme(interaction: discord.Interaction, word: str, rare: bool = False):
    await interaction.response.send_message(reply(f"สัมผัสกับ {word}", common=not rare, rhymes=word))


@tree.command(name="khamstart", description="หาคำไทยที่ขึ้นต้นด้วยข้อความนี้")
@app_commands.describe(text="เช่น นัก", rare="รวมคำหายากด้วย")
async def khamstart(interaction: discord.Interaction, text: str, rare: bool = False):
    await interaction.response.send_message(reply(f"ขึ้นต้นด้วย {text}", common=not rare, starts=text))


@tree.command(name="khamend", description="หาคำไทยที่ลงท้ายด้วยข้อความนี้")
@app_commands.describe(text="เช่น ภาพ", rare="รวมคำหายากด้วย")
async def khamend(interaction: discord.Interaction, text: str, rare: bool = False):
    await interaction.response.send_message(reply(f"ลงท้ายด้วย {text}", common=not rare, ends=text))


@tree.command(name="khampattern", description="หาคำไทยตามแพทเทิร์น (? = 1 ตัว, * = กี่ตัวก็ได้)")
@app_commands.describe(pattern="เช่น ก?ร หรือ *ภาพ")
async def khampattern(interaction: discord.Interaction, pattern: str):
    await interaction.response.send_message(reply(f"แพทเทิร์น {pattern}", common=False, pattern=pattern))


@client.event
async def on_ready():
    await tree.sync()  # registers the slash commands; global commands can take a while to appear
    print(f"Logged in as {client.user}. {len(wf):,} words loaded.")


if __name__ == "__main__":
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        sys.exit("Set the DISCORD_TOKEN environment variable first (see the top of this file).")
    client.run(token)
