"use client";
import {useLanguage,LanguageMenu} from "./language";
import AccountMenu from "./account-menu";
export default function EmptyServer({account,wanted}:{account:string;wanted:boolean}){const {t}=useLanguage();return <main className="login-page"><section className="login-card"><div className="section-heading"><LanguageMenu/><AccountMenu account={account} signOut="/api/auth/logout"/></div><h1>{t("Willkommen")}, {account}</h1><p>{t(wanted?"Kein Zugriff auf diesen Server.":"Noch kein Server verknüpft. Erstelle deinen Serverzugang in MineHost auf dem Handy oder öffne die Einladung eines Freundes.")}</p></section></main>;}
