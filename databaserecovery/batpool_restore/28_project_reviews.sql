-- Batpool #1 ProjectReview records

COPY public."ProjectReview" (id, "projectId", "reviewerId", "reviewerEmail", action, "previousStatus", "newStatus", notes, "internalNotes", "rejectionReason", "flagsRaised", "aiConfidenceScore", "createdAt") FROM stdin;
cmj3qmg9d009a6vbpmfpq6q0h	cmj2m1dgj00886vqy7glum3f9	\N	\N	SUBMITTED	DRAFT	SUBMITTED	\N	\N	\N	{short_campaign}	90	2025-12-13 03:29:50.545
cmj3r7n99003a6vttcv7um4n1	cmj2m1dgj00886vqy7glum3f9	cmii1r7rm00006voxkq6fj653	mikeisflux@indiecrowdfund.com	APPROVED	SUBMITTED	APPROVED			\N	{}	\N	2025-12-13 03:46:19.389
cmj3rb8q8006p6vtt9ili7ac9	cmj2m1dgj00886vqy7glum3f9	\N	\N	APPROVED	APPROVED	LIVE	Project launched by creator	\N	\N	\N	\N	2025-12-13 03:49:07.185
\.
