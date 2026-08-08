import { registerCrawler } from "crawler-core";
import { mockCrawler } from "./mock.js";

registerCrawler(mockCrawler);

export { mockCrawler };
