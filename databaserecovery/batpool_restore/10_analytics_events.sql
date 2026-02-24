-- Batpool #1 AnalyticsEvent records

COPY public."AnalyticsEvent" (id, "projectId", "eventType", referrer, channel, "customTag", amount, "userId", metadata, "timestamp") FROM stdin;
cmj2mz7ts00i06vqys20g2j39	cmj2m1dgj00886vqy7glum3f9	PROJECT_FOLLOW	\N	\N	\N	\N	cmj2mxg6b00fo6vqyz7e4yuy6	{"isPrelaunch": true}	2025-12-12 09:00:01.505
cmj2zjhh100br6vfvg6p2bvog	cmj2m1dgj00886vqy7glum3f9	PROJECT_FOLLOW	\N	\N	\N	\N	cmj2ziusb00bf6vfv5lq0wk0m	{"isPrelaunch": true}	2025-12-12 14:51:42.518
cmj3n98xr00156vf62v9ahjq9	cmj2m1dgj00886vqy7glum3f9	PROJECT_FOLLOW	\N	\N	\N	\N	cmj24mucn001i6vldsqjg4dma	{"isPrelaunch": true}	2025-12-13 01:55:35.68
\.
