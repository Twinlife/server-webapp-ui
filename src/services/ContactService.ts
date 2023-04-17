/*
 *  Copyright (c) 2021-2023 twinlife SA.
 *
 *  All Rights Reserved.
 *
 *  Contributors:
 *   Stephane Carrez (Stephane.Carrez@twin.life)
 */

import axios from "axios";
import config from "../config.json";

const url = config.rest_url;

export type TwincodeInfo = {
  name: string | null;
  description: string | null;
  avatarId: string | null;
  audio: boolean;
  video: boolean;
}

/**
 * Simple service to get the contact information (aka twincode attributes).
 */
export class ContactService {

  getTwincode(id: string) {
    return axios.get<TwincodeInfo>(url + '/twincodes/' + id);
  }

}
