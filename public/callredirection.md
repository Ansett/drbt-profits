DRBT calls redirection to Banana Gun for auto-buy
=================================================

`@tg_feedbot` can redirect DRBT calls to Banana to issue a scrapper buy command.
There is a free trial, then the $12 sub is needed.
It might work with `@Auto_Forward_Messages_Bot` also, configured differently, but I can't test without subscribing.

Indeed it might stop working if Banana updates the scrapping command.
Also, keep in mind that you'll get a buy for each call, while scrapper was filtering out duplicated calls.

In all the commands below, replace `PHONE` by your full Telegram phone number, excluding the + character, if any.

#### Connection to your TG account:
```
/connect PHONE
```
-> and follow the process

#### Getting source and target IDs:
```
/chats group PHONE
```
-> note the number ID of the chat receiving DRBT's calls (you'll replace CALLS_GROUP by this number in command below)
```
/chats bot PHONE
```
-> note the number ID of Banana Gun Sniper Bot (you'll replace BANANA_BOT by this number in command below)

#### Setting up redirection:
```
/redirection add banana on PHONE
```
-> paste:
```
CALLS_GROUP - BANANA_BOT
```

#### Setting up transformations:
```
/transformation add power banana on PHONE
```
-> after command validation, paste those two line in one go en press Enter:
```
.*?(0x\w{40}).*=/scrapev2 --address:\1 --numWallets:1 --ethAmount:0.05 --antiRug:1 --fof:0 --slippage:0.0 --tipAmount:0.0 --gwei:5 --buyTaxLimit:30 --sellTaxLimit:70 --minLiq:500 --maxLiq:100 --title:DRBT --isSnipe:0 --isBuy:1 --isBundleBackup:0 --backupTip:0.0 --isMaxTxOrRevert:1 --isTransferOnBlacklist:1 --link:https://t.me/c/@DeFiRobot_Dev_Bot/1
":","="
```
-> When asked for "Transformation Changes Preview", paste any ETH addy, like 0x661013bB8D1C95D86D9C85f76E9004561F1bB36F, and press Enter

-> then press Confirm button

In the scrapping parameters above I've set `--maxLiq:100` so Banana won't actually buy, it'll just show "Scraped DRBT" message so you know it works.

When it works, you'll want to set your own parameters (numWallets, ethAmount, maxLiq:0, ...) by running again `/transformation add power banana on PHONE` and pasting the 2 edited transformation lines.


#### Stopping redirection:

If you want to disable the redirection:
- Go to `/settings`
- Press on your phone number
- Press on `banana` (or whatever you called your redirection)
- Press on Disable (switching to Enable)
