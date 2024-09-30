DRBT calls redirection to Banana Gun for auto-buy
=================================================

The idea is to use a redirection TG bot to directly watch your DRBT calls group, transform the message and issue a buy command on Banana buy bot

It might stop working if Banana updates the scrapping command.
Also, keep in mind that you'll get a buy for each call, while scrapper was filtering duplicated calls out.

I tried [@tg_feedbot](https://t.me/tg_feedbot?start=aid-1971086651) and [@Auto_Forward_Messages_Bot](https://t.me/Auto_Forward_Messages_Bot?start=ref-1971086651)

Both have a free trial, then a subscription is needed ($12 for TeleFeed, $13 for AutoForward).
From my tests, Auto_Forward is a fraction of a second faster (probably with Boost mode activated) but I don't think it matters.
AutoForward has mobile and web apps which makes editing values easier.


AutoForward configuration
=========================

### Connection to your TG account:

Send `/connect` and follow the process.

Under `/profile`, activates *Settings* > *Boost Performance*

I highly suggest to use the mobile (use `/get_app`) or the [web](https://web.autoforwardtelegram.com) apps.

### Getting source and target IDs:
```
/getgroup
```
-> note the number ID of the group receiving DRBT's calls (you'll replace CALLS_GROUP by this number in the commands below)

-> note the number ID of some private group of your own where we can redirect buy orders for testing purpose (you'll replace TEST_GROUP by this number in the commands below)
```
/getuser
```
-> note the number ID of Banana Gun Sniper Bot (you'll replace BANANA_BOT by this number in the commands below)

### Setting up the redirection:
```
/forward add banana CALLS_GROUP -> TEST_GROUP
```

### Creating transformation:
Paste this multi-line command in one go and press enter:
```
/replace add call_power [[ALL_IN_ONE]] -> .*?address\/(\w+).*?LP:.*?V(\d).*?Since\sLaunch.*?(\d+\sdays\s\d\d:\d\d:\d\d)(?:.*?Bribes.*?(\d+))?.*=\\1&V\\2&D\\3&S\\4
&D0\sdays\s00:00:[012]\d&=&
&V2&=&
&D.*=@GWEI_FOR_BLOCK4+:5
&V3.*=@GWEI_FOR_UNI_V3:5
&S0?$=@GWEI_FOR_0_BRIBE:2
&S1$=@GWEI_FOR_1_BRIBE:2
&S\d$=@GWEI_FOR_2-9_BRIBES:3
&S1\d$=@GWEI_FOR_10-19_BRIBES:5
&S2\d$=@GWEI_FOR_20-29_BRIBES:5
&S3\d$=@GWEI_FOR_30-39_BRIBES:10
&S4\d$=@GWEI_FOR_40-49_BRIBES:15
&S.*$=@GWEI_FOR_50+_BRIBES:20
(.+?)@GWEI.+?:([\d.]+)=/scrapev2 --address:\\1 --gwei:\\2 --numWallets:1 --ethAmount:0.05 --antiRug:1 --isTransferOnBlacklist:1 --buyTaxLimit:30 --sellTaxLimit:70 --minLiq:500 --maxLiq:0.0 --slippage:0.0 --isBuy:1 --isSnipe:0 --fof:0 --isBundleBackup:0 --tipAmount:0.0 --backupTip:0.0 --isMaxTxOrRevert:1 --title:DRBT --link:t.me/DeFiRobot_Dev_Bot
":","="
```
(The name must end with _power)

Or, if you want a fixed GWEI delta, paste this instead:
```
/replace add call_regex .*?address\/(\w+)\b.* -> /scrapev2 --address=\1 --gwei=10 --numWallets=1 --ethAmount=0.05 --antiRug=1 --isTransferOnBlacklist=1 --buyTaxLimit=30 --sellTaxLimit=70 --minLiq=500 --maxLiq=0.0 --slippage=0.0 --isBuy=1 --isSnipe=0 --fof=0 --isBundleBackup=0 --tipAmount=0.0 --backupTip=0.0 --isMaxTxOrRevert=1 --title=DRBT --link=t.me/DeFiRobot_Dev_Bot
```
(The name must end with _regex)

### Linking transformations:

- Go to `/settings`
- *Manage Forwarding Tasks*
- *banana*
- *Advanced Configuration*
- *Replace*
- Select `call_power` (or `call_regex`)

### Testing:
If you didn't get any error message when configuring, you can test if it works:

Copy-paste or forward a DRBT call into your CALLS_GROUP and then check your TEST_GROUP to see if the final `/scrapev2` command looks fine.

You can then **edit the redirection to forward to Banana**:
- The easiest is to use the mobile or web app (click on the task, *Edit Target* and select the bot)
- or edit the target in TG:
  - Go to `/forward`
  - *banana*
  - *Edit Target Chat*
  - Paste the BANANA_BOT numeric ID you noted earlier

### Adjust values to your liking:
The values gwei, limits an other scrapping values are just examples. You should use your own values.
  
To edit the buy order values it's way easier to use the **mobile or web app** :
- *Replace* menu
- Select `call_power`
- *Edit Replace*
- Edit values in *New Words Replace* field 
  - Adjust **gwei delta** amounts after the colon on each `GWEI_FOR_...` line
  - **Buy parameters** and conditions like `--numWallets`, `--ethAmount`, `--buyTaxLimit` and such

You can also edit the *Replace* in the TG bot:
- Go to `/replace`
- *Show All*
- Select any `call_power`
- *Edit Replacement Text*
- Paste the new replacement text (that's what follow the -> arrow in the long replace command from "Creating transformation" section)

### Stopping redirection:

- Go to `/forward`
- *banana*
- *Advanced Configuration*
- *Stop Forwarding*

On the mobile or web app:
- Press *banana*
- Go to the menu top right
- *Stop Forwarding*



TeleFeed configuration
======================

In all the commands below, replace `PHONE` by your full Telegram phone number, excluding the + character, if any.

### Connection to your TG account:
```
/connect PHONE
```
-> and follow the process

### Getting source and target IDs:
```
/chats group PHONE
```
-> note the number ID of the group receiving DRBT's calls (you'll replace CALLS_GROUP by this number in the commands below)

-> note the number ID of some private group of your own where we can redirect buy orders for testing purpose (you'll replace TEST_GROUP by this number in the commands below)
```
/chats bot PHONE
```
-> note the number ID of Banana Gun Sniper Bot (you'll replace BANANA_BOT by this number in the commands below)

### Setting up the redirection:
```
/redirection add banana on PHONE
```
-> paste:
```
CALLS_GROUP - TEST_GROUP
```

### Setting up transformations:
```
/transformation add power banana on PHONE
```
-> after pressing Enter, paste all those lines in one go, adjust values and press Enter:
```
.*?address\/(\w+).*?LP:.*?V(\d).*?Since\sLaunch.*?(\d+\sdays\s\d\d:\d\d:\d\d)(?:.*?Bribes.*?(\d+))?.*=\1&V\2&D\3&S\4
&D0\sdays\s00:00:[012]\d&=&
&V2&=&
&D.*=@GWEI_FOR_BLOCK4+:5
&V3.*=@GWEI_FOR_UNI_V3:5
&S0?$=@GWEI_FOR_0_BRIBE:2
&S1$=@GWEI_FOR_1_BRIBE:2
&S\d$=@GWEI_FOR_2-9_BRIBES:3
&S1\d$=@GWEI_FOR_10-19_BRIBES:5
&S2\d$=@GWEI_FOR_20-29_BRIBES:5
&S3\d$=@GWEI_FOR_30-39_BRIBES:10
&S4\d$=@GWEI_FOR_40-49_BRIBES:15
&S.*$=@GWEI_FOR_50+_BRIBES:20
(.+?)@GWEI.+?:([\d.]+)=/scrapev2 --address:\1 --gwei:\2 --numWallets:1 --ethAmount:0.05 --antiRug:1 --fof:0 --slippage:0.0 --tipAmount:0.0 --buyTaxLimit:30 --sellTaxLimit:70 --minLiq:500 --maxLiq:0.0 --title:DRBT --isSnipe:0 --isBuy:1 --isBundleBackup:0 --backupTip:0.0 --isMaxTxOrRevert:1 --isTransferOnBlacklist:1 --link:t.me/DeFiRobot_Dev_Bot
":","="
```
-> When asked for "Transformation Changes Preview", just type "x", enter, and click Correct


### Testing:
If you didn't get any error message when configuring, you can test if it works:

Copy-paste or forward a DRBT call into your CALLS_GROUP and then check your TEST_GROUP to see if the final `/scrapev2` command looks fine.

You can then **edit the redirection to forward to Banana**:
```
/redirection change test on PHONE
```
-> paste:
```
CALLS_GROUP - BANANA_BOT
```


### Adjust values to your liking:
The values gwei, limits an other scrapping values are just examples. You should use your own values.

To edit the buy order values, follow the steps of "Setting up transformations" section while editing the values before validating the big paste:
- Adjust **gwei delta** amounts after the colon on each `GWEI_FOR_...` line
- **Buy parameters** and conditions like `--numWallets`, `--ethAmount`, `--buyTaxLimit` and such

You can check your current transformation with
```
/transformation active on PHONE
```

### Stopping redirection:

If you want to disable the redirection:
- Go to `/settings`
- Press on your phone number
- Press on *banana*
- Press on *Disable* (switching to *Enable*)