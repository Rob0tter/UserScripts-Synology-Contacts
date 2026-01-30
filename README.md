![Logo](./_logo.png)
 
# Pimp my Contacts

Order by last name, use german date format, add context menu for contact details and much more

## Installation
In your browser, you need a userscript engine installed like TamperMonkey or GreaseMonkey.
Within the monkey, add this script with regard to your Calendar web address. After reloading, the script will apply.

## Description
- Ever wanted to have your contacts ordered and displayed with their lastname first? The script is the answer!
- Furthermore, you can add custom context actions to data fields when displaying a contact card.
- When using your own data categories, i.e. "Wedding" for the date when people have married, Synology will always convert that string to lower case. Now you have the option to re-capitalize that - just a little annoyance, but it made me crazy...
- All date fields are formated in ISO format YYYY-M-D. Now they can be localized to german format DD.MM.YYYY-M-D

You can switch all options on and off separately inside the script code.

## Limitations
At the moment, only languages english (locale: en) and german (locale: de) are supported. Please make sure to set the proper locale for your language in the script´s configuration area!

## Tested environments
This UserScript has been tested with:

- Synology Contacts 1.0.10
- Chrome 143
- TamperMonkey 5.4.1
- Windows 11
