/*
 *  Copyright (c) 2023 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Olivier Dupont <olivier.dupont@twin.life>
 */
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./ar.json";
import cn from "./cn.json";
import de from "./de.json";
import dk from "./dk.json";
import en from "./en.json";
import fa from "./fa.json";
import fi from "./fi.json";
import fr from "./fr.json";
import he from "./he.json";
import hi from "./hi.json";
import in_resources from "./in.json";
import it from "./it.json";
import jp from "./jp.json";
import kr from "./kr.json";
import nl from "./nl.json";
import no from "./no.json";
import pl from "./pl.json";
import pt from "./pt.json";
import ru from "./ru.json";
import sp from "./sp.json";
import su from "./su.json";
import tu from "./tu.json";
import tw from "./tw.json";
import uk from "./uk.json";

const resources = {
	en,
	fr,
	ar,
	"zh-cn": cn,
	tw,
	dk,
	nl,
	fi,
	de,
	he,
	hi,
	in: in_resources,
	it,
	jp,
	kr,
	no,
	fa,
	pl,
	pt,
	ru,
	sp,
	su,
	tu,
	uk,
};

i18n.use(LanguageDetector)
	.use(initReactI18next) // passes i18n down to react-i18next
	.init({
		resources,
		fallbackLng: "en",
		// lng: "en",
		// language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
		// you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
		// if you're using a language detector, do not define the lng option

		interpolation: {
			escapeValue: false, // react already safes from xss
		},
	});

export default i18n;
