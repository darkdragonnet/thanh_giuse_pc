--
-- PostgreSQL database dump
--

\restrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_class_name_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_department_id_fkey;
DROP INDEX IF EXISTS public.idx_persons_sync_status;
DROP INDEX IF EXISTS public.idx_persons_person_id;
DROP INDEX IF EXISTS public.idx_persons_name_class;
DROP INDEX IF EXISTS public.idx_persons_alias;
DROP INDEX IF EXISTS public.idx_classes_name;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_action;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_pkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_alias_id_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS public.persons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.classes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.persons_id_seq;
DROP TABLE IF EXISTS public.persons;
DROP TABLE IF EXISTS public.departments;
DROP SEQUENCE IF EXISTS public.classes_id_seq;
DROP TABLE IF EXISTS public.classes;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    action character varying(100) NOT NULL,
    user_id character varying(100) DEFAULT 'ANONYMOUS'::character varying,
    username character varying(100),
    role character varying(50),
    status_code integer,
    ip_address character varying(50),
    user_agent text,
    target_id character varying(150),
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    alias_id character varying(100),
    person_id character varying(100),
    name character varying(255) NOT NULL,
    class_name character varying(100),
    department_id character varying(50),
    title character varying(100) NOT NULL,
    face_url text,
    sync_status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persons_id_seq OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persons_id_seq OWNED BY public.persons.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: persons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons ALTER COLUMN id SET DEFAULT nextval('public.persons_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at) FROM stdin;
1	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_YB6Z	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_YB6Z", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 05:59:24.483953+00
2	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_48P3	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_48P3", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:00:47.157064+00
3	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_CC3O	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_CC3O", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:09:20.660158+00
4	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_HBS2	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_HBS2", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:11:27.181345+00
5	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_EME7	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh Vào đời 1", "title": "Học Sinh", "aliasID": "TN_Chung_EME7", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 09:24:06.820561+00
6	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.196.44	Mozilla/5.0 (Linux; Android 13; CPH2237 Build/TP1A.220905.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_ZYA1	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Quỳnh Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_ZYA1", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 10:40:22.995999+00
7	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	45.118.138.93	Mozilla/5.0 (Linux; Android 15; SM-A266B Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_11JA	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Lê Nguyễn Gia Huy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_11JA", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 12:03:15.228575+00
8	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_QIBI	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trần Lan Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_QIBI", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:24.255721+00
9	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_REIQ	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Vân Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_REIQ", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:58.585617+00
10	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_S9S3	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Phạm Vũ Huy Khang", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_S9S3", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:18:42.592296+00
11	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_B82P	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh", "title": "Học Sinh", "aliasID": "TN_Chung_B82P", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:30:03.804205+00
12	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_FKIA	{"query": {}, "params": {}, "changes": {"name": "Urxula_Trần Thị Bảo Minh_vaodoi1_minh_fkey", "title": "Học Sinh", "aliasID": "TN_Chung_FKIA", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:32:32.403501+00
13	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	113.174.15.98	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_BAODONG2A_5B89	{"query": {}, "params": {}, "changes": {"name": "MARIA Hoàng Thị Kim Ngân", "title": "Học Sinh", "aliasID": "TN_BAODONG2A_5B89", "className": "BAODONG2A", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 15:22:19.751025+00
14	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.68.22	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260802802 ZaloTheme/light ZaloLanguage/vn	TN_GLV_5CVP	{"query": {}, "params": {}, "changes": {"name": "TÔMA Hoàng Thành Lợi", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_5CVP", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 04:55:39.691773+00
15	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_PPZD	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_PPZD", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:00:16.82033+00
16	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_RIS4	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh ", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_RIS4", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:01:51.033503+00
17	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:6388:8e8c:50a1:819e:c35:bc96	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36	TN_GLV_U77E	{"query": {}, "params": {}, "changes": {"name": "GIOAN Phạm Tiến Chức", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_U77E", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 09:24:08.481923+00
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, name, department_id, created_at) FROM stdin;
1	BAODONG1A	990653	2026-09-30 05:36:03.210476
2	BAODONG1B	990653	2026-09-30 05:36:03.281118
3	BAODONG1C	990653	2026-09-30 05:36:03.33306
4	BAODONG2A	990653	2026-09-30 05:36:03.370024
5	BAODONG2B	990653	2026-09-30 05:36:03.434035
6	BAODONG3	990653	2026-09-30 05:36:03.474686
7	DMHCCC	990730	2026-09-30 05:36:03.549569
8	GLV	990653	2026-09-30 05:36:03.577341
9	KHAITAM1	990653	2026-09-30 05:36:03.666323
10	KHAITAM2	990653	2026-09-30 05:36:03.675684
11	KHAITAM3	990653	2026-09-30 05:36:03.7053
12	THEMSUC1A	990653	2026-09-30 05:36:03.74369
13	THEMSUC1B	990653	2026-09-30 05:36:03.793887
14	THEMSUC1C	990653	2026-09-30 05:36:03.827899
15	THEMSUC2A	990653	2026-09-30 05:36:03.859373
16	THEMSUC2B	990653	2026-09-30 05:36:03.90906
17	THEMSUC2C	990653	2026-09-30 05:36:03.958411
18	THEMSUC3A	990653	2026-09-30 05:36:03.994913
19	THEMSUC3B	990653	2026-09-30 05:36:04.037681
20	THEMSUC3C	990653	2026-09-30 05:36:04.096797
21	VAODOI1	990653	2026-09-30 05:36:04.151386
22	VAODOI2	990653	2026-09-30 05:36:04.19325
23	XUNGTOI1A	990653	2026-09-30 05:36:04.213688
24	XUNGTOI1B	990653	2026-09-30 05:36:04.260115
25	XUNGTOI2A	990653	2026-09-30 05:36:04.302486
26	XUNGTOI2B	990653	2026-09-30 05:36:04.346273
27	XUNGTOI3A	990653	2026-09-30 05:36:04.392903
28	XUNGTOI3B	990653	2026-09-30 05:36:04.450243
29	XUNGTOI3C	990653	2026-09-30 05:36:04.506426
30	THEMSUC	990653	2026-10-01 07:16:07.240949
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, code) FROM stdin;
990653	Thiếu Nhi	TN
990730	Legiô Mariae	LM
990731	Giới Trẻ	GT
\.


--
-- Data for Name: persons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persons (id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at) FROM stdin;
1	\N	\N	GIUSE Nguyễn Đình Thiên Ân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
2	\N	\N	TÊRÊSA Trần Ngọc Quỳnh Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
3	\N	\N	MARIA Danh Nguyễn Hoài Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
4	\N	\N	TÊRÊSA Đỗ Hà Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
5	\N	\N	GIUSE Nguyễn Duy Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
6	\N	\N	GIUSE Vũ Xuân Bắc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
7	\N	\N	GIUSE Nguyễn Bùi Gia Bảo	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
8	\N	\N	ANNA Nguyễn Bảo Châu	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
9	\N	\N	MARIA Nguyễn Khánh Chi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
10	\N	\N	VINHSƠN Trần Thành Cương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
11	\N	\N	VINHSƠN Lê Hải Đăng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
12	\N	\N	MARIA Hoàng Bích Diệp	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
13	\N	\N	PHÊRÔ Mai Nguyên Đức	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
14	\N	\N	GIUSE Trịnh Nam Dương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
15	\N	\N	MARIA Ngô Gia Hân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
16	\N	\N	MARIA Trần Thị Hoài	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
17	\N	\N	GIUSE Nguyễn Thế Hoàng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
18	\N	\N	GIOANB. Hồ Quốc Hưng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
19	\N	\N	ANTÔN Trần Nhật Huy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
20	\N	\N	PHAOLÔ Bùi Phúc Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
21	\N	\N	EMMANUEL Nguyễn Bảo Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
22	\N	\N	MICAE Nguyễn Minh Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
23	\N	\N	GIOAN B. Dương Đình Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
24	\N	\N	GIUSE Phạm Đăng Khoa	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
25	\N	\N	PHAOLÔ Nguyễn Trung Kiên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
26	\N	\N	MARIA Nguyễn Trịnh Nhã Lam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
27	\N	\N	TÊRÊSA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
28	\N	\N	MARIA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
29	\N	\N	MARIA Nguyễn Uyên Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
30	\N	\N	ANNA Trương Ngọc Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
31	\N	\N	PHÊRÔ Trình Nguyễn Hoàng Long	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
32	\N	\N	MARIA Nguyễn Khánh Ly	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
33	\N	\N	MARIA Nguyễn Lê Hà My	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
34	\N	\N	MARIA Nguyễn Thị Phương Nam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
35	\N	\N	MARIA Trần Bảo Nghi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
36	\N	\N	MARIA Nguyễn Thị Bảo Ngọc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
37	\N	\N	AUGUSTINÔ Nguyễn Hoàng Nguyên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
38	\N	\N	MARIA Nguyễn Thanh Trúc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
39	\N	\N	ANNA Nguyễn Nhật Vy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
40	\N	\N	ĐAMINH Đinh Hoàng Gia	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
41	\N	\N	ĐAMINH Ngô Gia Hưng	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
42	\N	\N	GIUSE Trần Bảo Lâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
43	\N	\N	MARIA Nguyễn My My	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
44	\N	\N	MARIA Trần Ly Na	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
45	\N	\N	GIUSE Trần Bảo Nam	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
46	\N	\N	MARIA Đinh Thanh Ngọc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
47	\N	\N	GIUSE Trần Đức Nguyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
48	\N	\N	TÊRÊSA Nguyễn Thị Thiên Nhi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
49	\N	\N	MARIA Vũ Đàm An Nhiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
50	\N	\N	PHAOLÔ Nguyễn Vũ Nhật Phong	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
51	\N	\N	MARIA Nguyễn Ngọc Thiên Phúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
52	\N	\N	ANNA Trương Thanh Thảo	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
53	\N	\N	MARIA Nguyễn Thị Mai Thi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
54	\N	\N	MARIA Đinh Thị Anh Thư	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
55	\N	\N	MARIA Tạ Thuỷ Tiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
56	\N	\N	GIUSE Phan Thành Tiến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
57	\N	\N	PHÊRÔ Nguyễn Tuấn Toàn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
58	\N	\N	MARIA Nguyễn Bảo Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
59	\N	\N	ROSA Ngô Nguyễn Quỳnh Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
60	\N	\N	MARIA Trần Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
61	\N	\N	ANNA Trần Nguyễn Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
62	\N	\N	MARIA Trần Thị Quỳnh Trang	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
63	\N	\N	PHÊRÔ Trần Đình Triết	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
64	\N	\N	MARIA Trần Vũ Kiều Trinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
65	\N	\N	MARIA Cao Nguyễn Bảo Trúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
66	\N	\N	GIUSE Vũ Trần Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
67	\N	\N	VINHSƠN Nguyễn Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
68	\N	\N	GIUSE Lê Kiến Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
69	\N	\N	BÊNAĐÔ Nguyễn Hoàng Minh Tuấn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
70	\N	\N	TÊRÊSA Nguyễn Phương Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
71	\N	\N	MARIA Hà Nhã Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
72	\N	\N	PHAOLÔ Nguyễn Công Vinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
73	\N	\N	MARIA Vũ Thị Tường Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
74	\N	\N	TÊRÊSA MARIA Phạm Trịnh Trúc Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
75	\N	\N	MARIA Đinh Hoàng Hải Yến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
76	\N	\N	PHÊRÔ Nguyễn Hoàng Tuấn Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
77	\N	\N	TÊRÊSA Nguyễn Hồng Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
78	\N	\N	Wang Thiên Bội	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
79	\N	\N	MARIA Nguyễn Ngọc Bảo Châu	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
80	\N	\N	GIUSE Nguyễn Tuấn Cường	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
81	\N	\N	PHÊRÔ Nguyễn Hoàng Dương	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
82	\N	\N	ANNA Phạm Nguyễn Gia Hân	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
83	\N	\N	GIUSE Nguyễn Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
84	\N	\N	GIUSE Lê Gia Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
85	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
86	\N	\N	PHÊRÔ Nguyễn Hoàng Anh Khôi	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
87	\N	\N	GIUSE Phùng Lê Trung Kiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
88	\N	\N	ĐAMINH Đoàn Phi Long	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
89	\N	\N	PHÊRÔ Nguyễn Bảo Nam	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
90	\N	\N	MATTA Nguyễn Gia Như	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
91	\N	\N	GIUSE Trần Thanh Phong	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
92	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
93	\N	\N	MARIA Huỳnh Nguyễn Ngọc Thảo	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
94	\N	\N	GIUSE Phạm Hoàng Thiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
95	\N	\N	TÊRÊSA Phạm Vân Trang	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
96	\N	\N	MARIA Vũ Đoàn Thảo Vy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
97	\N	\N	TÊRÊSA Nguyễn Hoài An	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
98	\N	\N	ANNA Trần Quỳnh Anh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
99	\N	\N	GIOAN BOSCO Nguyễn Đình Bách	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
100	\N	\N	ANNA Đỗ Lê Khánh Băng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
101	\N	\N	ĐAMINH Nguyễn Thanh Bình	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
102	\N	\N	GIUSE Vũ Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
103	\N	\N	PHÊRÔ Nguyễn Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
104	\N	\N	GIUSE Đỗ Nguyễn Tuấn Đạt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
105	\N	\N	MARIA Nguyễn Thị Ngọc Diệu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
106	\N	\N	PHÊRÔ Phạm Hoàng Định	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
107	\N	\N	GIUSE Văn Minh Thiên Đức	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
108	\N	\N	MARIA Nguyễn Ngọc Dung	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
109	\N	\N	GIOAN B. Ngô Mạnh Dũng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
110	\N	\N	PHÊRÔ Bùi Lê Khánh Duy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
111	\N	\N	AUGUSTINÔ Nguyễn Minh Hải	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
112	\N	\N	MARIA Phan Vũ Bảo Hân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
113	\N	\N	LUCA Trần Dương Trọng Hiếu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
114	\N	\N	VINHSƠN Phạm Gia Hưng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
115	\N	\N	MARIA Hoàng Thị Thu Hường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
116	\N	\N	PHÊRÔ Trần Gia Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
117	\N	\N	GIUSE Nguyễn Nhật Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
118	\N	\N	GIUSE Lê Đăng Khoa	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
119	\N	\N	MARIA Đỗ Phan Bảo Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
121	\N	\N	GIUSE Nguyễn Minh Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
122	\N	\N	GIUSE Võ Hoàng Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
124	\N	\N	LUCIA Lưu Hoàng Bảo Ngọc	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
125	\N	\N	AUGUSTINÔ Nguyễn Nhật Khôi Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
126	\N	\N	PHÊRÔ Mai Long Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
127	\N	\N	GIUSE Đào Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
128	\N	\N	PHÊRÔ Vũ Thành Nhân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
129	\N	\N	GIUSE Bùi Nguyễn Minh Nhật	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
130	\N	\N	AUGUSTINÔ Lê Đỉnh Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
131	\N	\N	GIUSE Nguyễn Hoàng Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
132	\N	\N	MARIA Phạm Hoài Thương	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
120	\N	\N	MARIA Trần Thị Diệu Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
133	\N	\N	TÊRÊSA Đặng Ngọc Bảo Trâm	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
134	\N	\N	GIUSE Lê Quốc Việt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
135	\N	\N	MARIA Nguyễn Phương Vy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
136	\N	\N	GIOAN BAOTIXITA Triệu Trường Vỹ	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
137	\N	\N	TÊRÊSA Phan Thị Vân Anh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
138	\N	\N	PHANXICÔ Phạm Lê Trung Hiếu	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
139	\N	\N	PHÊRÔ Thái Khải Hoàng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
140	\N	\N	LUCIA Nguyễn Ngọc Kiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
141	\N	\N	ANNA Lê Thanh Kiều Linh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
142	\N	\N	MARIA Nguyễn Minh Bảo Ngọc	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
143	\N	\N	GIUSE Tống Trần Phúc Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
144	\N	\N	ĐAMINH Nguyễn Khôi Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
145	\N	\N	MARIA Trần Dương Thảo Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
146	\N	\N	MARIA Trương Hoàng Yến Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
147	\N	\N	TÊRÊSA Nguyễn Linh Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
148	\N	\N	ANTÔN Trịnh Quang Thành Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
149	\N	\N	PHÊRÔ Ngô Phan Lai Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
150	\N	\N	PHÊRÔ Xích Công Thiên Phong	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
151	\N	\N	ANNA Hoàng Nguyễn Mai Phương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
152	\N	\N	PHAOLÔ Nguyễn Hải Quân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
153	\N	\N	MARIA Nguyễn Đinh Tú Quỳnh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
154	\N	\N	GIUSE Nguyễn Huỳnh Khánh Tâm	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
155	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
156	\N	\N	ANNA Hồ Phạm Anh Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
157	\N	\N	MARIA Vũ Thị Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
158	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
159	\N	\N	MARIA Trịnh Minh Trang	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
160	\N	\N	GIOAKIM Vũ Thanh Tùng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
161	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Vương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
162	\N	\N	MARIA Phạm Phương Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
163	\N	\N	MARIA Trần Ngọc Khánh Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
164	\N	\N	MARIA Nguyễn Thúy Hà Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
165	\N	\N	MARIA Phạm Hồng Triệu Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
166	\N	\N	PHÊRÔ Nguyễn Khánh An	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
167	\N	\N	MARTINÔ Đinh Đặng Thiên Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
168	\N	\N	TÊRÊXA Nguyễn Hồng Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
169	\N	\N	MARIA Nguyễn Thị Hải Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
170	\N	\N	ANNA Võ Thị Vân Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
171	\N	\N	TÊRÊSA Trần Mỹ Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
172	\N	\N	MARIA Cao Kiều Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
173	\N	\N	ANNA Nguyễn Trâm Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
174	\N	\N	MARIA Lương Tiểu Băng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
175	\N	\N	GIOAN BAOTIXITA Trần Quốc Bảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
176	\N	\N	GIOAN B. Nguyễn Ngọc Thanh Bình	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
177	\N	\N	TÊRÊSA Lê Ngọc Lan Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
178	\N	\N	MARIA Tạ Quỳnh Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
182	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Diễm	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
183	\N	\N	PHÊRÔ Nguyễn Huỳnh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
184	\N	\N	GIUSE Nguyễn Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
185	\N	\N	TÔMA Bùi Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
186	\N	\N	MARIA Nguyễn Thị Thùy Dung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
187	\N	\N	PHÊRÔ Trần Đức Duy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
188	\N	\N	PHÊRÔ Nguyễn Ngọc Minh Hoàng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
189	\N	\N	MARIA Trần Thị Thu Hường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
190	\N	\N	PHÊRÔ Trần Quang Khải	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
191	\N	\N	GIUSE Nguyễn Phúc Khang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
192	\N	\N	MARIA Phạm Kim Khanh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
194	\N	\N	MARIA Nguyễn Thị Phương Linh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
195	\N	\N	GIUSE Ngyễn Ngọc Bảo Long	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
196	\N	\N	TÊRÊSA Nguyễn Trần Thảo My	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
197	\N	\N	CLARA Nguyễn Duy Mỹ	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
198	\N	\N	VINHSƠN Trần Uy Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
199	\N	\N	GIUSE Nguyễn Thành Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
179	\N	\N	PHÊRÔ Nguyễn Việt Cường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
180	\N	\N	MARIA Bùi Ngọc Linh Đan	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
181	\N	\N	SIMON PHAOLÔ Nguyễn Hoàng Đạt	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
200	\N	\N	ISAVE Nguyễn Ngọc Thủy Ngân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
201	\N	\N	MARIA Phạm Ngọc Gia Ngyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
202	\N	\N	MARIA Trần Ngọc Uyên Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
203	\N	\N	MARIA Mai Vũ Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
204	\N	\N	MARIA Lê Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
205	\N	\N	MARIA Nguyễn Thị Quỳnh Như	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
206	\N	\N	TÊRÊSA Hà Trang Nhung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
207	\N	\N	GIOAN Hoàng Thiên Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
208	\N	\N	GIUSE Trần Đức Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
209	\N	\N	PHILIPPHÊ Nguyễn Hoàng Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
210	\N	\N	PHÊRÔ Lê Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
211	\N	\N	GIUSE MARIA Nguyễn Minh Quân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
212	\N	\N	GIUSE Trần Hiếu Thảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
213	\N	\N	TÊRÊSA Nguyễn Phạm Bảo Thy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
214	\N	\N	ANNA Phạm Hoàng Thủy Tiên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
215	\N	\N	MARIA Lê Trần Nguyên Trang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
216	\N	\N	MARTINÔ Vũ Trần Đức Trí	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
217	\N	\N	ĐAMINH Đinh Phi Trường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
218	\N	\N	PHÊRÔ Trần Đình Tùng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
219	\N	\N	MARIA Nguyễn Đoàn Bảo Uyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
220	\N	\N	ANTÔN Ngô Công Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
221	\N	\N	PHÊRÔ Nguyễn Phong Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
224	\N	\N	GIUSE Cao Tấn Bình	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
227	\N	\N	MARIA Nguyễn Thị Nha	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
228	\N	\N	MARIA Nguyễn Thị Yến	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
236	\N	\N	MARIA Trịnh Thị Hoa	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
237	\N	\N	GIUSE Nguyễn Thanh Long	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
241	\N	\N	MARIA Trần Thị Duyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
242	\N	\N	MARIA Đào Thị Phương Thảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
244	\N	\N	PHANXICÔ XAVIÊ Vũ Đoàn Bảo Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
246	\N	\N	MARIA Trần Ngọc Uyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
248	\N	\N	MARIA Nguyễn Huỳnh Khánh Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
249	\N	\N	MARIA Nguyễn Thị Phước	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
251	\N	\N	MARIA Nguyễn Thị Thu Ngọc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
254	\N	\N	GIUSE Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
261	\N	\N	MADALENA Huỳnh Thị Ngọc Vy	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
264	\N	\N	LUCA Đỗ Đức Trọng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
266	\N	\N	GIOAN Trần Văn Phương	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
268	\N	\N	ANTÔN Trần Nguyễn Xuân Lộc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
269	\N	\N	MARIA Nguyễn Thị Xuyến	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
274	\N	\N	GIUSE Nguyễn Duy Pháp	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
276	\N	\N	ĐAMINH Trương Quang Chung	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
285	\N	\N	CELESTINÔ Nguyễn Quốc Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
286	\N	\N	LUI Lê Anh Minh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
223	TN_BAODONG3_38U1	3328995786624073728	Phê Rô Trần Đình Tùng	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4c51fa70-2381-4e94-a7a0-4dfe678795a7.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.371516
225	LM_DMHCCC_WMGW	3326007309951303680	ANNA Trần Thị Quy	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/fbcb46e2-8fd0-4e58-9174-6f8f7546e0a9.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.614804
230	LM_DMHCCC_4KZ3	3326385095140442112	MARIA Trần Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/b56368cf-61fe-439a-8585-1c59d79161ce.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.622023
231	LM_DMHCCC_PJL6	3326392862773346304	MARIA Phạm Thị Mai	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/3433efb9-e8d3-4095-9ee1-243e36ae4dd2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.631018
229	LM_DMHCCC_9QHS	3327100769005469696	MARIA Vũ Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/d457eee4-ee79-451c-9195-204186e34c51.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.63708
226	LM_DMHCCC_T83U	3329347380171505664	CATARINA Nguyễn Thị Hương Giang	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/92f91378-79ed-427b-9386-645accc65084.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.652366
289	\N	\N	GIUSE Võ Hồng Em	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
291	\N	\N	TERESA Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
292	\N	\N	Phan Tuấn Anh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
997	TN_GLV_4ZLV	3318421576143077376	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/a0a95749-5ba9-4cc8-b0f2-9402259fc24e.jpg	SYNCED	2026-10-01 09:11:40.089368	2026-10-01 09:11:40.089368
233	\N	\N	GIUSE Cao Tấn Lộc	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
234	\N	\N	MARIA Nguyễn Thị Thê	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
235	\N	\N	LUCA Đỗ Ngọc Lâm	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
293	\N	\N	Nguyễn Trần Gia Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
294	\N	\N	Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
295	\N	\N	Phùng Văn Đức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
296	\N	\N	Nguyễn Trí Hào	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
297	\N	\N	Nguyễn Đức Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
298	\N	\N	Nguyễn Mạnh Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
299	\N	\N	Phạm Đức Lượng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
301	\N	\N	Đoàn Thanh Nhàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
302	\N	\N	Trần Ngọc Thảo Nhi	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
303	\N	\N	Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
304	\N	\N	Nguyễn Thị Mỹ Tâm	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
305	\N	\N	Trần Danh Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
312	\N	\N	GIUSE Đoàn Gia Phú	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
313	\N	\N	MARIA Lý San San	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
314	\N	\N	MARIA Lê Nguyễn Thiên An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
315	\N	\N	MARIA Nguyễn Huỳnh Khánh An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
316	\N	\N	MARIA Nguyễn Linh Anh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
317	\N	\N	GIOAN BAPTIST Nguyễn Kim Bảo	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
243	TN_GLV_ACIP	3318330549059190784	TERESA MARIA Nguyễn Thị Cương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/3bd097a7-242c-493b-951f-1bd18456796d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.060312
275	TN_GLV_YFH0	3318416787397148672	MARIA Nguyễn Thị Thể	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/8b5bf3ee-9a01-4c97-ab23-4b320c41d082.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.074402
253	TN_GLV_ESNY	3318418277750800384	MARIA Hoàng Anh Thư	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/c91d682f-433a-4ea4-bf94-901b2d0d32c4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.079724
256	TN_GLV_7A8J	3318422336469729280	GIUSE Phan Chính Hướng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7dec3b3a-cab6-467f-a738-9c7be17c052c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.096999
240	TN_GLV_YNCN	3318424907527749632	TERESA Phùng Thị Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a387268-102f-409f-8671-59dec16d0114.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.101442
247	TN_GLV_XY0C	3318450257800462336	MARIA Trần Ngọc Mai Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81207a82-01ab-4fab-b769-30b086b9df2b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.110024
267	TN_GLV_BKBJ	3318791672199905280	TERESA Nguyễn Thị Kiều	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ba85fe6c-2738-4028-ab04-08749683ba06.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.116251
255	TN_GLV_B9RH	3319007037530046464	MATTA Phùng Nguyên Phương Nhi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/d3382c28-8248-4e6c-95ed-601b91431f4a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.136391
252	TN_GLV_7O99	3319095003652816896	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ab8ef4f2-5b03-48bc-a596-c69353cb4981.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.141605
272	TN_GLV_EJKS	3319980022374072320	ĐA MINH Bùi Tấn Đạt	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/62667b8a-96a1-40d8-9cad-bf39009c7d77.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.156323
273	TN_GLV_FK2S	3320464283921285120	LUCIA Lê Thanh Minh Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e30f9dcc-9bd5-4cd3-b134-4e901ea7903c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.161374
265	TN_GLV_KBKT	3320466582416654336	ANNA Nguyễn Thị Lan Hương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7e2e274a-4c48-4c37-9c06-08d55453256f.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.171834
257	TN_GLV_3QAP	3320468870753419264	MARIA Nguyễn Thị Thanh Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/14e63f76-e062-4a8b-9120-8dd6215f4ea8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.177193
262	TN_GLV_J7JL	3320489451355897856	PHÊRÔ Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.188294
270	TN_GLV_0QFY	3318308764574023680	MARIA Nguyễn Huỳnh Khánh Uyên	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/73f97198-3d23-4a61-9cfe-5a30f20a0add.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.051407
258	TN_GLV_00PD	3319789794514436096	MARIA Phan Thị Hằng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a0c5f80-6ae1-4ce8-9236-cc46a7056167.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.150904
250	TN_GLV_VVRL	3320492381521838080	TERESA Nguyễn Triệu Mỹ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/1a252637-dde1-4e0f-b68f-7a1eedfa327d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.193949
245	TN_GLV_RTTN	3323503762542166016	MARIA Nguyễn Thị Ngọc Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/56e2316b-3c17-4caa-a3b2-d0ed562d84e9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.211565
260	TN_GLV_Z9C0	3323957150899765248	MARIA Nguyễn Thị Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e72749c-d6a8-4a6e-abe3-6455ee28a97b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.217294
263	TN_GLV_9FBU	3323957550256226304	MARIA Phạm Thị Thực	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/703f7b5b-4b1e-4dde-811f-448173c7dd83.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.223722
238	LM_DMHCCC_I2SG	3325595360948125696	MARIA Nguyễn Thị Thật	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/4514121a-3f94-4049-beec-5ebc3b7eca19.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.608514
239	LM_DMHCCC_GWQI	3330804726420733952	Bà Chiến Lêgio	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/f38b6769-adb8-4e66-b63c-ade569ebbf75.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.664097
277	\N	\N	GIUSE Nguyễn Chí Phú	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
280	\N	\N	GIOAN BAOTIXITA Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
283	\N	\N	PHÊRÔ Trần Đình Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
318	\N	\N	MARIA Nguyễn Thị Lan Chi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
319	\N	\N	ANNA Lê Ngọc linh Đan	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
320	\N	\N	MARIA Bùi Ngọc Diệp	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
321	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
322	\N	\N	MARIA Nguyễn Đăng Minh Hằng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
323	\N	\N	PHANXICÔ XAVIÊ Nguyễn Phú Gia Khiêm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
324	\N	\N	Lý Anh Khôi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
325	\N	\N	MARIA Thái Trúc Lâm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
326	\N	\N	TÊRÊSA Đặng Trúc Nghi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
327	\N	\N	MARIA Trần Vũ Bảo Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
328	\N	\N	MARIA Nguyễn Huỳnh Mỹ Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
331	\N	\N	MARIA Nguyễn Huỳnh Bảo Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
332	\N	\N	TÊRÊSA Nguyễn Ngọc Quỳnh Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
333	\N	\N	MARIA Nguyễn Đỗ Quyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
334	\N	\N	MAĐALÊNA Trần Thị Lan Thanh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
335	\N	\N	MARIA Nguyễn Ngọc Khánh An	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
336	\N	\N	GIUSE Phạm Thiên Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
337	\N	\N	ANTÔN Nguyễn Trần Đức Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
338	\N	\N	TÊRÊSA Ngô Ngọc Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
339	\N	\N	Nguyễn Ngọc Trâm Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
340	\N	\N	GIOAN B. Nguyễn Hoàng Thiên Bảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
341	\N	\N	GIUSE Phùng Lê An Bình	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
342	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
344	\N	\N	MARIA Bùi Gia Hân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
345	\N	\N	MARIA Võ Xuân Hạnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
346	\N	\N	GIUSE Lê Quốc Vũ Hoàng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
347	\N	\N	MARIA Phùng Ngọc Khánh Huyền	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
348	\N	\N	GIUSE Đoàn Nguyên Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
349	\N	\N	PHÊRÔ Lê Trần Duy Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
350	\N	\N	GIOAN B. Trần Minh Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
351	\N	\N	PHÊRÔ Nguyễn Xuân Hoàng Khôi	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
352	\N	\N	MARIA Lưu Hoàng Kim	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
353	\N	\N	MARIA Thái Trúc Lâm	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
354	\N	\N	ANNA Nguyễn Kim Ngọc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
355	\N	\N	Bùi Nguyễn Trọng Phát	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
288	TN_GLV_8CQW	3318875957460205568	GIOAKIM Nguyễn Tâm Tỉnh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9a4d7d0c-c7f1-4f62-b4cb-c947ba137ee0.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.126176
278	TN_GLV_MPFD	3318895424332365824	MARIA Nguyễn Thị Vy	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/900d36f1-8bec-4d7d-8fc5-0d51a7e57ee8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.131171
284	TN_GLV_WTMA	3319107475684196352	GIOAN BAOTIXITA Võ Quốc Sang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9e88624a-81a8-49a2-8b8f-c23747fe7f85.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.145992
287	TN_GLV_IYPD	3320465446548799488	MARIA Nguyễn Mỹ Lệ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/6daba4e8-c073-420c-8615-08868ada425a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.166163
308	TN_GLV_1BTM	3320474344940896256	Vinh sơn Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/2ed354eb-ca50-48af-9a35-5e14040084a9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.182392
281	TN_GLV_UUYD	3320555706267992064	GIUSE Nguyễn Văn Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cdc3cc55-0c92-4f6a-8a05-8960d747eeb4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.200682
307	TN_GLV_GAG3	3318869643774394368	Vinh Sơn Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cd67259c-b6a8-4058-a78b-c84ccefd2853.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.121096
310	TN_GLV_8OXZ	3323973694744690688	JB Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/702e92ab-a8d8-4cfc-a4b6-70045d17da58.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.238019
309	GLV_70	3320489451355897856	Phê-rô Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 07:16:06.972659
311	TN_GLV_5Z9D	3324074415100002304	Luy Lê Anh Minh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/875c4eff-95d2-4cb6-9da8-f3b3175f3770.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.243561
290	TN_GLV_7P8S	3326851047594393600	AUGUSTINÔ Đặng Hùng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/69752799-7b60-4026-bcdf-7a53890af636.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.274321
306	TN_GLV_68RW	3329800250893271040	GIUSE Nguyễn Thanh Long	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e21af251-ac85-4257-9e79-6dcec638d25a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.515011
279	TN_GLV_LAQI	3331088036556439552	PHÊRÔ Hoàng Văn Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/88559e00-e3eb-4f3b-be4b-6676009da112.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.537818
329	\N	\N	GIUSE Nguyễn Hải Nguyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
330	\N	\N	PHÊRÔ Trần Thành Nhân	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
356	\N	\N	Wang Thiệu Phong	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
357	\N	\N	GIOAN B. Võ Hoàng Phúc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
358	\N	\N	MARIA Nguyễn Thị Phương Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
359	\N	\N	MARIA Lâm Nguyễn Ngọc Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
360	\N	\N	MARIA Bùi Anh Thư	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
361	\N	\N	PHÊRÔ Nguyễn Phú Tịnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
362	\N	\N	MARIA Trần Lê Hoàng Yến	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
368	\N	\N	PHANXICÔ Phạm Gia Bảo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
370	\N	\N	MARIA Ngô Lệ Lan Chi	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
373	\N	\N	MARIA Phạm Ngọc Diệp	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
374	\N	\N	GIUSE Lê Nguyễn Minh Đức	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
378	\N	\N	EMMANUEL Lê Hạo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
391	\N	\N	MARIA Lê Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
394	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
395	\N	\N	GIUSE Mai Phúc Thịnh	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
396	\N	\N	MARIA Đặng Trần Giáng Tiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
400	\N	\N	RAPHAEL Lê Ngọc Huyền Chân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
401	\N	\N	GIUSE Nguyễn Tiến Dũng	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
402	\N	\N	LUCIA Huỳnh Thị Ngọc Hân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
403	\N	\N	PHÊRÔ Lê Anh Khoa	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
404	\N	\N	PHANXICÔ Dương Minh Khôi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
405	\N	\N	MONICA Đinh Tuệ Lâm	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
406	\N	\N	MARIA Nguyễn Thùy Linh	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
407	\N	\N	PHANXICÔ Nguyễn Thiên Lộc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
408	\N	\N	ĐAMINH Nguyễn Minh Long	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
409	\N	\N	ANNA Nguyễn Hoàng My	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
410	\N	\N	MARIA Trần Ngọc Khánh Ngân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
411	\N	\N	MARIA Trần Thị Phương Nghi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
412	\N	\N	MARIA Nguyễn Khánh Ngọc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
413	\N	\N	MARIA Lã Hà Gia Nguyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
414	\N	\N	TÊRÊSA Nguyễn Lường Yến Nhi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
415	\N	\N	PHÊRÔ Nguyễn Gia Phúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
416	\N	\N	PHAOLÔ Đặng Ngọc Minh Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
417	\N	\N	GIUSE Nguyễn Trần Nhật Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
418	\N	\N	MARIA Trần Bảo Quyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
419	\N	\N	TÔMA Nguyễn Phú Tài	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
420	\N	\N	GIUSE Nguyễn Quốc Thái	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
377	TN_THEMSUC1A_0S88	3328966772257718272	MARIA Phạm Trương Gia Hân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4fdd67df-d521-44be-adb0-8d615c15a9a9.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.319335
376	TN_THEMSUC1A_2EX4	3328995363662069760	MARIA TÊRÊSA Trần Thanh Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ca805157-4cf7-4e58-96de-2df35f89c1e4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.353809
366	TN_THEMSUC1A_2ZO3	3328995570265096192	MARIA Trương Quỳnh Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f4b3d4af-7f40-4a33-8223-1fbb3af3f83a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.365749
375	TN_THEMSUC1A_3QYP	3328995874310193152	TÊRÊSA Nguyễn Thị Thu Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1cce40e3-a9e7-41bf-b124-09cbccfc4073.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.376784
372	TN_THEMSUC1A_6CUJ	3328996891386970112	PHÊRÔ Bạch Công Đăng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f56db1c3-e74e-4077-81e2-658e7af7c265.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.39856
371	TN_THEMSUC1A_AEVZ	3328998513097834496	MARIA Trần Linh Đan	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0887a289-aef9-474d-be5a-9c09a91810a6.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.433062
367	TN_THEMSUC1A_AUYC	3328998667473387520	MARIA Trần Ngọc Ánh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/becfddd0-fc84-4f9e-baa9-fe4ff875e92e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.438332
379	TN_THEMSUC1A_BHCP	3328998914064908288	PHANXICÔ Đinh Vũ Minh Hiếu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3ac0aaf5-1624-41f8-b115-94759f326221.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.449811
363	TN_THEMSUC1A_EP29	3329000175828992000	GIUSE Trần Nam An	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/87ad8952-ba8f-4f2e-b4c8-c93169b0cf86.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.474185
343	TN_KHAITAM3_QD6D	3329146302435950592	GIOAN B. Trần Thiên Duy	KHAITAM3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/caeaf0ca-35df-4348-97bb-b247e90e6c55.jpg	SYNCED	2026-09-30 05:36:03.7053	2026-10-01 09:11:40.48176
421	\N	\N	MARIA Nguyễn Võ Xuân Thảo	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
422	\N	\N	GIUSE Hoàng Chí Thiện	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
365	TN_THEMSUC1A_0QA6	3326358193973493760	Nguyễn Ngọc Thuỳ Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f97bb99d-750f-443a-a9c3-a8e7648dff7c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.259881
386	\N	\N	MATTA Nguyễn Thị Ngọc Mai	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
387	\N	\N	MARIA Nguyễn Phan Diễm My	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
388	\N	\N	MARIA Đoàn Vũ Ánh Ngọc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
423	\N	\N	MARIA Nguyễn Hoàng Anh Thư	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
424	\N	\N	GIUSE Nguyễn Minh Trí	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
425	\N	\N	MARIA Lê Nhã Trúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
426	\N	\N	INHAXIÔ Võ Đặng Khánh Tường	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
435	\N	\N	MARIA Lý Gia Hân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
436	\N	\N	AUGUSTINÔ Nguyễn Minh Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
437	\N	\N	PHÊRÔ Nguyễn Trịnh Tuấn Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
440	\N	\N	TÊRÊSA Nguyễn Thị Trà My	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
441	\N	\N	GIUSE Nguyễn Gia Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
442	\N	\N	GIUSE Nguyễn Khôi Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
444	\N	\N	GIUSE Đỗ Gia Phúc	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
446	\N	\N	VINHSƠN Phạm Hoàng Quân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
447	\N	\N	MARIA Ngô Như Quỳnh	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
449	\N	\N	TÊRÊSA Lê Ngọc Khả Ái	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
450	\N	\N	GIUSE Nguyễn Quốc An	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
451	\N	\N	ROSA Thẩm Phẩm Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
452	\N	\N	MARIA Võ Quỳnh Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
453	\N	\N	MARIA Ngô Ngọc Ánh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
454	\N	\N	GIOAN B. Sơn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
455	\N	\N	GIUSE Lê Huy Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
456	\N	\N	PHANXICÔ Nguyễn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
457	\N	\N	MARIA Phan Mai Ca	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
458	\N	\N	MARIA Nguyễn Minh Châu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
459	\N	\N	CATARINA Huỳnh Khiết Đan	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
460	\N	\N	GIUSE Nguyễn Bạch Hải Đăng	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
461	\N	\N	MARIA Đoàn Gia Di	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
462	\N	\N	ANTÔN Hoàng Minh Đức	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
463	\N	\N	PHÊRÔ Dương Thái Duy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
464	\N	\N	MARIA Phạm Nguyễn Gia Hân	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
465	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
466	\N	\N	GIOAN Nguyễn Minh Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
467	\N	\N	PHÊRÔ Lê Đăng Khoa	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
468	\N	\N	GIOAN PHAOLÔ II Phạm Anh Minh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
398	TN_THEMSUC1A_4GVC	3328996152241553408	PHAOLÔ Nguyễn Minh Trí	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/520fc538-b9f0-4176-b6a2-899d0960aa12.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.382002
381	TN_THEMSUC1A_53TY	3328996438259531776	TÔMA Trần Văn Hưng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0178b03b-1aab-4b78-8b8a-735cd961877a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.387525
399	TN_THEMSUC1A_72AM	3328997169871978496	MATTA Lê Phương Uyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/685b21e5-c202-477c-81a2-0a39659fc0d8.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.403885
384	TN_THEMSUC1A_7JYJ	3328997362793185280	RAPHAEL Phạm Thế Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f2a4cf57-e82a-457f-85fa-bb15026c97aa.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.410363
389	TN_THEMSUC1A_87RS	3328997618746392576	ANNA Trương Ngọc Thảo Nguyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/824e7051-67d9-4176-ab2a-b66911167694.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.416258
390	TN_THEMSUC1A_8XI8	3328997893875957760	ANNA THÀNH Nguyễn Thị Tuyết Nhi	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/b5730630-e9a8-413c-97f5-9361a45f76a4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42125
397	TN_THEMSUC1A_9S71	3328998250257580032	MARIA Vũ Bảo Trân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/22c68b7a-a3d6-492f-8926-bbd94bcd6914.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42689
380	TN_THEMSUC1A_C0TL	3328999120072343552	PHAOLÔ Lê Đức Hòa	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/a3197833-e794-4edb-b420-765ab3b4027d.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.455643
385	TN_THEMSUC1A_CJT5	3328999320048369664	ANNA Thái Thị Trúc Linh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/66e5b08b-4a99-4129-b742-3ec43dac385e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.461165
393	TN_THEMSUC1A_D9U6	3328999597837123584	MARIA Lê Như	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9198f391-40cb-495d-8602-7121923b1a50.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.467371
427	TN_THEMSUC_1C_YZBW	3329769151831998464	TÊRÊSA Nguyễn Đỗ Hoài An	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/644880c0-f738-4f56-9486-2a3be167a52e.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.509205
428	TN_THEMSUC_1C_PG82	3330371052592168960	MARIA Phạm Nguyễn Hà Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9bb28e83-a45f-4685-8639-21554def3fb0.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.521239
469	\N	\N	ĐAMINH Nguyễn Hải Nam	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
470	\N	\N	MARIA Phạm Yến Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
392	TN_THEMSUC1A_JR1Q	3328959937563852800	MAĐALÊNA Lâm Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7b42fbff-35e7-4716-95be-fa2f6bc83b41.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.307114
431	\N	\N	TÔMASÔ Trần Hoàng Gia Bảo	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
432	\N	\N	MARIA Đặng Phương Mỹ Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
433	\N	\N	TÊRÊSA Trần Ngọc Lan Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
471	\N	\N	MARIA Mai Vũ Uyên Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
472	\N	\N	MARIA Trần Tú Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
473	\N	\N	LUCIA Phạm Thị Quỳnh Như	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
474	\N	\N	VINHSƠN Phạm Hồng Thiên Phát	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
475	\N	\N	PHANXICÔ Kiều Phong	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
476	\N	\N	PHÊRÔ Xích Công Thiện Phú	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
477	\N	\N	MICAE Phan Nguyễn Tiến Quốc	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
478	\N	\N	TÊRÊSA Trịnh Bùi Gia Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
479	\N	\N	TÊRÊSA Đỗ Diễm Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
480	\N	\N	MARIA Huỳnh Thị Tiết Sương	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
481	\N	\N	PHÊRÔ Phạm Hoàng Tấn	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
482	\N	\N	ANNA Trần Thị Anh Thơ	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
483	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
484	\N	\N	TÊRÊSA Nguyễn Bảo Trâm	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
489	\N	\N	MARIA Phạm Thảo An	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
490	\N	\N	MARIA Đặng Nguyễn Diệu Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
491	\N	\N	MARIA Nguyễn Ngọc Anh Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
492	\N	\N	GIÊRAĐÔ Phạm Bảo Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
493	\N	\N	PHÊRÔ Nguyễn Trung Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
494	\N	\N	GIUSE Trần Thanh Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
495	\N	\N	PHAOLÔ Phạm Thành Công	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
496	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
497	\N	\N	TÔMA Nguyễn Trần Thái Hòa	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
499	\N	\N	GIOAN B. Ngô Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
500	\N	\N	ANTÔN Vũ Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
501	\N	\N	PHÊRÔ Trần Gia Hưng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
502	\N	\N	ĐAMINH Lại Trần Quốc Huy	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
503	\N	\N	GIUSE Nguyễn Duy Khang	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
504	\N	\N	ĐAMINH Đinh Gia Khiêm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
505	\N	\N	PHAOLÔ Nguyễn Bảo Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
506	\N	\N	TÔMA Trần Nguyên Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
507	\N	\N	ANTÔN Trương Trung Kiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
508	\N	\N	MARIA Bùi Nguyễn Nhật Lam	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
509	\N	\N	ANNA Nguyễn Lê Nhật Linh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
510	\N	\N	MICAE Nguyễn Uy Long	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
511	\N	\N	TÊRÊSA Đỗ Hà Uyên Minh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
512	\N	\N	MARIA Trần Phạm Khánh My	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
513	\N	\N	TÊRÊSA Lê Hoàng Thảo Nghi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
514	\N	\N	MARIA Trần Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
515	\N	\N	MARIA Nguyễn Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
516	\N	\N	MARIA Tạ Quỳnh Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
517	\N	\N	MARIA Vũ Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
518	\N	\N	ANNA Phan Ngọc Yến Nhi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
519	\N	\N	MARIA Trần Ngọc Trúc Như	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
520	\N	\N	PHÊRÔ Nguyễn Thanh Gia Phú	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
521	\N	\N	TÊRÊSA Phạm Vũ Minh Tâm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
522	\N	\N	GIOAN B. Nguyễn Ngọc Minh Thắng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
523	\N	\N	ĐAMINH Nguyễn Minh Thiện	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
434	TN_THEMSUC1C_4CFF	3328897607052296192	PHANXICÔ Vũ Minh Đăng	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/277583f7-2abc-4e26-85c8-f0fd7182cdf7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.284887
439	TN_THEMSUC1C_5MST	3328898065976262656	MARIA Vũ Thị Trà My	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/2a5f3644-430a-4d0d-b4c3-70ac8bd9aea7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.290734
443	TN_THEMSUC1C_7PX6	3328898956250841088	MARIA Trương Trần Tuyết Nhi	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ac1b83b7-c0d0-4d33-adbb-de4ea33c4129.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.296374
445	TN_THEMSUC1C_8IK9	3328899345977180160	MICAE Phan Vũ Minh Quân	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e7f75a8c-cf85-47ef-8524-1391b616d98c.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.301708
524	\N	\N	ANPHONGSÔ Đỗ Phạm Quốc Thịnh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
525	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
448	TN_THEMSUC1C_YUAS	3326985968413573120	PHANXICÔ XAVIÊ Trần Hoàng Việt	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9024dacd-c482-4263-bd08-6a4f550441ce.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.279737
485	\N	\N	MARIA Trần Thị Tuyết	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
486	\N	\N	MATTA Lê Nhã Uyên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
487	\N	\N	TÊRÊSA Trần Ngọc Lan Vy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
488	\N	\N	MATTA Bùi Ngọc Hoàng Yến	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
526	\N	\N	ANTÔN Trương Chính Trực	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
527	\N	\N	GIUSE Mai Anh Tuấn	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
528	\N	\N	MARIA Lê Thị Thảo Vi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
529	\N	\N	ANNA Trần Hải Yến	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
530	\N	\N	ANTÔN Nguyễn Minh Thiên Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
531	\N	\N	LUCIA Trương Nguyễn Hồng Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
532	\N	\N	MARIA Trần Đoàn Phương Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
534	\N	\N	MARIA Nguyễn Trâm Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
535	\N	\N	PHANXICÔ XAVIÊ Phạm Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
536	\N	\N	TÔMASÔ Trần Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
538	\N	\N	PHÊRÔ Nguyễn Trung Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
539	\N	\N	GIUSE Hoàng Công Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
540	\N	\N	ĐAMINH Đỗ Chí Hưng	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
542	\N	\N	GIUSE Phan Quốc Huy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
544	\N	\N	MARIA Nguyễn Thị Mỹ Huyền	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
545	\N	\N	GIUSE Trương Tuấn Khang	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
546	\N	\N	MARIA Nguyễn Vũ Khánh Ngọc	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
547	\N	\N	MARIA Nguyễn Thị Minh Nguyệt	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
548	\N	\N	GIUSE Đào Quốc Phát	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
549	\N	\N	PHAOLÔ Nguyễn Hoàng Phi	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
550	\N	\N	MARIA Hoàng Anh Thư	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
551	\N	\N	TÔMASÔ Đặng Phúc Vinh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
552	\N	\N	MICAE Trần Thái Vũ	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
553	\N	\N	ANNA Trần Phương Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
554	\N	\N	TÊRÊSA Bùi Lê Khánh Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
555	\N	\N	MATTA Nguyễn Như Ý	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
556	\N	\N	MARIA Nguyễn Hải Yến	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
557	\N	\N	GIOAN Nguyễn Phúc An	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
558	\N	\N	MARIA Nguyễn Bảo Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
559	\N	\N	TÊRÊSA Phạm Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
560	\N	\N	MARIA Nguyễn Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
561	\N	\N	MARIA Nguyễn Lê Ngọc Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
562	\N	\N	MARIA Nguyễn Thị Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
563	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
564	\N	\N	LUCA Hồ Tuấn Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
565	\N	\N	PHANXICÔ XAVIÊ Trần Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
566	\N	\N	GIUSE Vũ Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
567	\N	\N	MARIA Nguyễn Phạm Thiên Ân (tâm Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
568	\N	\N	MARIA Nguyễn Phạm Thiên Ân (như Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
569	\N	\N	GIUSE Phạm Đức Cường	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
570	\N	\N	GIUSE Nguyễn Thành Đạt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
571	\N	\N	GIOAN B. Trần Tứ Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
572	\N	\N	GIUSE Nguyễn Phùng Thiên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
573	\N	\N	PHÊRÔ Mai Nguyên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
574	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
575	\N	\N	PHÊRÔ Nguyễn Nhật Huy	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
576	\N	\N	MAĐALÊNA Phan Hoàng An Huyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
577	\N	\N	GIOAN Lê Nguyễn An Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
578	\N	\N	GIOAN Phạm Trí Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
579	\N	\N	GIUSE Nguyễn Đăng Khoa	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
580	\N	\N	GIOAN Trần Nguyên Khôi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
581	\N	\N	PHAOLÔ Bùi Quán Kiệt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
582	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
583	\N	\N	MARIA Nguyễn Ngọc Gia Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
584	\N	\N	MARIA Phạm Hoài Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
369	TN_THEMSUC1A_NB6E	3328961743941533696	PHÊRÔ Bùi Bối Bối	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/dec33767-7baf-4675-a784-df164b18720c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.312815
222	TN_BAODONG3_02BA	3328995387393441792	Vicente Trần Uy Nam	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/d8c06290-adbc-49ae-bc48-b363ac1eabc5.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.359825
585	\N	\N	GIUSE Trương Thế Lộc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
586	\N	\N	VINHSƠN Phạm Nguyễn Gia Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
587	\N	\N	PHAOLÔ Nguyễn Công Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
588	\N	\N	TÊRÊSA Trần Dương Trà My	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
589	\N	\N	MARIA Lý Nguyễn Kim Ngân	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
590	\N	\N	TÊRÊSA Nguyễn Khánh Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
591	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
592	\N	\N	MARIA Trương Phương Nhi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
593	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
594	\N	\N	TÊRÊSA Huỳnh Nữ Ngọc Tiên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
595	\N	\N	MARIA Đinh Ngọc Nhã Uyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
596	\N	\N	MARIA Phạm Ngọc Như ý	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
597	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
598	\N	\N	PHÊRÔ Nguyễn Đình Thế Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
599	\N	\N	GIACÔBÊ Trần Bạch Hải Đăng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
600	\N	\N	MARIA Đoàn Ngọc Thiên Di	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
601	\N	\N	PHAOLÔ Nguyễn Văn Đồng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
602	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
604	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
605	\N	\N	PHÊRÔ Vương Đăng Khoa	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
606	\N	\N	MARIA Vũ Đoàn Khánh Linh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
607	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
608	\N	\N	GIUSE Phạm Nguyễn Khôi Nguyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
609	\N	\N	MARIA Nguyễn Hồ Như Nguyệt	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
610	\N	\N	GIUSE Lê Nguyễn Thiện Nhân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
611	\N	\N	PHAOLÔ Nguyễn Võ Hoàng Nhật	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
612	\N	\N	MARIA Hoàng Nguyễn Phương Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
613	\N	\N	ANNA Nguyễn Ngọc Thảo Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
614	\N	\N	MARIA Vũ Võ Quỳnh Như	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
615	\N	\N	GIUSE Đỗ Ngọc Phát	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
616	\N	\N	ANTÔN Phạm Hoàng Phong	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
617	\N	\N	ĐAMINH Nguyễn Trần Gia Phúc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
618	\N	\N	TÊRÊSA Nguyễn Mai Phước	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
619	\N	\N	MARIA Nguyễn Hoàng Nam Phương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
620	\N	\N	MICAE Phan Vũ Anh Quân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
621	\N	\N	GIUSE Bùi Trấn Quốc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
622	\N	\N	GIUSE Võ Văn Quý	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
623	\N	\N	MARIA Nguyễn Đặng Ngọc Quyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
624	\N	\N	ANNA Vương Nguyễn Như Quỳnh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
625	\N	\N	PHANXICÔ Phan Võ Tấn Sinh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
626	\N	\N	MARIA Phan Phương Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
627	\N	\N	MARIA Đặng Uyên Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
628	\N	\N	MARIA Vũ Minh Thư	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
629	\N	\N	PHÊRÔ Trần An Thuyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
630	\N	\N	Huỳnh Nữ Ngọc Tiên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
631	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
632	\N	\N	GIUSE Lê Minh Triết	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
633	\N	\N	PHÊRÔ Nguyễn Minh Tuấn	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
634	\N	\N	PHAOLÔ Nguyễn Thanh Tùng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
635	\N	\N	MARIA Vũ Phạm Khánh Tường	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
636	\N	\N	GIACÔBÊ Võ Đặng Khánh Đình Vương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
637	\N	\N	MARIA Nguyễn Ngọc Bảo An	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
638	\N	\N	GIUSE Nguyễn Thiên Ân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
639	\N	\N	ANNA Đặng Trâm Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
640	\N	\N	MARIA Nguyễn Đinh Quỳnh Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
641	\N	\N	GIUSE Trần Bảo Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
642	\N	\N	GIUSE Trịnh Hoàng Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
643	\N	\N	CATARINA Nguyễn Khánh Băng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
644	\N	\N	GIOAN Nguyễn Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
645	\N	\N	GỈOAN Phạm Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
646	\N	\N	MARIA Tạ Hoài Phương Chi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
647	\N	\N	GIOAN Phan Thành Công	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
648	\N	\N	PHÊRÔ Vũ Phú Cường	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
649	\N	\N	TÊRÊSA Nguyễn Đỗ Linh Đan	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
603	\N	\N	GIOAN BAOTIXITA Nguyễn Thành Hưng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
650	\N	\N	GIUSE Lê Tiến Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
651	\N	\N	VINHSƠN Nguyễn Văn Quốc Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
652	\N	\N	GIOAN Vũ Minh Đức	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
653	\N	\N	ANNA Hoàng Thị Diễm Hằng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
654	\N	\N	PHAOLÔ Huỳnh Phước Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
655	\N	\N	PHANXICÔ Nguyễn Quốc Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
656	\N	\N	PHAOLÔ Vũ Minh Khoa	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
657	\N	\N	PHÊRÔ Nguyễn Đặng Quốc Kiệt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
658	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
659	\N	\N	GIÊGÔRIÔ Trần Hoàng Long	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
660	\N	\N	PHANXICÔ Nguyễn Duy Mạnh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
662	\N	\N	MARIA Trần Phạm Thảo My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
663	\N	\N	ANNA Lê Khởi My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
664	\N	\N	MARIA Trần Hồng Ngọc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
665	\N	\N	ANTÔN Trịnh Quang Thành Nhân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
666	\N	\N	MARIA Lê Vũ Yến Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
667	\N	\N	MARIA Trần Thảo Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
668	\N	\N	PHÊRÔ Võ Hoàng Phát	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
669	\N	\N	GIUSE Phạm Trí Quốc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
670	\N	\N	MARIA Trương Huỳnh Anh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
671	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
672	\N	\N	MARIA Trần Hồ Bảo Trân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
673	\N	\N	MARIA Vũ Kiều Trang	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
674	\N	\N	ANTÔN Trương Anh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
675	\N	\N	PHÊRÔ Trần Mạnh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
676	\N	\N	PHÊRÔ Vũ Văn Tùng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
677	\N	\N	MARIA Lê Phương Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
678	\N	\N	MATTA Phạm Thị Kim Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
679	\N	\N	MARIA Trần Phạm Thảo Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
680	\N	\N	(DỰ TÒNG) Nguyễn Nhật Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
681	\N	\N	ANNA Nguyễn Khánh Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
682	\N	\N	ANNA Hoàng Quỳnh Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
683	\N	\N	PHÊRÔ Bùi Mai Quang Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
684	\N	\N	GIUSE Nguyễn Bùi Hoàng Đạt	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
685	\N	\N	MARIA Nguyễn Thị Ngọc Diễm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
686	\N	\N	MARIA Võ Nguyễn Khánh Hà	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
687	\N	\N	TÊRÊSA Trương Thanh Hiền	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
688	\N	\N	ĐAMINH Lê Văn Hoàng	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
689	\N	\N	PHÊRÔ Nguyễn Xuân Huy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
690	\N	\N	PHÊRÔ Nguyễn Hoàng Lâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
691	\N	\N	TÊRÊSA Trương Thị Ngọc Lan	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
692	\N	\N	MARIA Phạm Hoàng Phương Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
693	\N	\N	TÊRÊSA Mai Ngọc Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
694	\N	\N	GIUSE Phạm Thành Lộc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
695	\N	\N	URSULA Trần Thị Bảo Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
696	\N	\N	PHÊRÔ Bùi Mai Quang Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
697	\N	\N	VINHSƠN Vũ Hải Nam	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
698	\N	\N	INÊ Nguyễn Ngọc Ngân	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
699	\N	\N	MARIA Trần Thị Hồng Nhung	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
700	\N	\N	LUCA Nguyễn Lộc Phát	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
701	\N	\N	GIUSE Nguyễn Minh Phúc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
702	\N	\N	MARIA Trần Mai Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
703	\N	\N	MARIA Lã Hà Kiều Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
704	\N	\N	GIOAN Nguyễn Việt Quang	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
705	\N	\N	GIUSE Vũ Hồ Thành Tâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
706	\N	\N	MARIA Vũ Kiều Thanh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
707	\N	\N	MARIA Phạm Hoàng Minh Thùy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
708	\N	\N	MARIA Nguyễn Bảo Thy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
709	\N	\N	PHAOLÔ Nguyễn Văn Trường	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
710	\N	\N	TÊRÊSA Phan Ngọc Uyên	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
711	\N	\N	GIOAN Trần Gia Bảo	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
712	\N	\N	GIUSE Vũ Văn Cảnh	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
713	\N	\N	TÔMASÔ Phan Đình Chung	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
714	\N	\N	ANTÔN Nguyễn Trung Hà	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
715	\N	\N	MARIA Lê Thanh Hằng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
716	\N	\N	GIUSE Nguyễn Mạnh Hùng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
717	\N	\N	GIOAN B. Đỗ Ngọc Phước	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
718	\N	\N	PHAOLÔ Trần Hồng Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
719	\N	\N	ANTÔN Trương Trung Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
720	\N	\N	GIUSE Nguyễn Minh Quang	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
721	\N	\N	MARIA Nguyễn Bùi Thủy Trúc	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
722	\N	\N	MARIA Trần Thanh Vân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
726	\N	\N	MARIA Bùi Phương Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
727	\N	\N	Nguyễn Lê Gia Bảo	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
728	\N	\N	Đan Quỳnh Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
729	\N	\N	MARIA Nguyễn An Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
730	\N	\N	GIUSE Phạm Tiến Đạt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
731	\N	\N	ANNA Bùi Hạnh Dung	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
732	\N	\N	PHAOLÔ Nguyễn Huy Hải	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
733	\N	\N	GIUSE Phạm Tấn Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
734	\N	\N	PHANXICÔ Nguyễn Nhật Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
735	\N	\N	GIUSE Nguyễn Phúc Gia Khiêm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
736	\N	\N	Hoàng Xuân Khôi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
737	\N	\N	GIUSE Mai Tuấn Kiệt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
738	\N	\N	ANÊ Phạm Gia Linh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
739	\N	\N	PHÊRÔ Phạm Văn Minh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
740	\N	\N	Nguyễn Bảo Nam	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
741	\N	\N	MARIA Trần Khánh Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
742	\N	\N	MARIA Nguyễn Bích Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
743	\N	\N	MARIA Nguyễn Ngọc Bảo Nhi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
744	\N	\N	Đỗ An Nhiên	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
745	\N	\N	Lê Ngọc Quỳnh Như	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
746	\N	\N	PHÊRÔ Nguyễn Anh Phát	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
747	\N	\N	PHÊRÔ Nguyễn Đình Phong	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
748	\N	\N	PHÊRÔ Lê Ngọc Phúc	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
749	\N	\N	GIUSE Đoàn Quý Phước	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
750	\N	\N	PHANXICÔ XAVIÊ Nguyễn Văn Minh Quân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
751	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
752	\N	\N	Nguyễn Ngọc Đan Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
753	\N	\N	MARIA Nguyễn Ngọc Linh San	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
754	\N	\N	MARIA Hoàng Thục Tâm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
755	\N	\N	GIUSE Dương Thành Thắng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
756	\N	\N	PHÊRÔ Nguyễn Phúc Thịnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
757	\N	\N	MARIA Đặng Uyên Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
758	\N	\N	Trần Minh Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
759	\N	\N	ANNA Lê Thị Mỹ Trinh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
760	\N	\N	MARIA Đỗ Ngọc Cát Tường	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
761	\N	\N	MARIA Nguyễn Bảo Yến	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
762	\N	\N	GIUSE Nguyễn Trần Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
763	\N	\N	PHÊRÔ Trần Nguyễn Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
765	\N	\N	PHANXICÔ Phạm Nguyễn Minh Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
766	\N	\N	MARIA Nguyễn Phạm Yên Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
767	\N	\N	MARIA Đinh Phương Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
769	\N	\N	Đỗ Ngọc Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
770	\N	\N	Cao Khả Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
771	\N	\N	AUGUSTINÔ Võ Gia Hưng	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
772	\N	\N	MARIA Nguyễn Lê Quỳnh Hương	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
774	\N	\N	ĐAMINH Nguyễn Minh Khang	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
775	\N	\N	GIUSE Bùi Nguyễn Minh Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
776	\N	\N	PHÊRÔ Trần Đăng Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
777	\N	\N	MARIA Nguyễn Quý Kiều	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
778	\N	\N	MARIA Trần Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
779	\N	\N	ANNA Nguyễn Ngọc Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
780	\N	\N	PHANXICÔ XAVIÊ Phạm Nguyễn Gia Minh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
781	\N	\N	VICENTÊ Nguyễn Thiện Nhân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
782	\N	\N	MARIA Mai Quỳnh Như	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
785	\N	\N	GIUSE Nguyễn Hoàng Minh Phước	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
787	\N	\N	TÊRÊSA Đặng Nguyễn Anh Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
788	\N	\N	MARIA Nguyễn Lê Huyền Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
789	\N	\N	MARIA Nguyễn Ngọc Cát Tiên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
723	\N	\N	MARIA Hoàng Hải Yến	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
724	\N	\N	VINHSƠN Hồ Thiên Ân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
725	\N	\N	Nguyễn Quỳnh Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
790	\N	\N	GIOAN Trần Tuấn Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
791	\N	\N	PHÊRÔ Hoàng Thị Anh Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
792	\N	\N	LUCIA Lê Nguyễn Tú Uyên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
793	\N	\N	ANNA Lê Tường Vy	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
794	\N	\N	ANNA Nguyễn Bảo An	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
796	\N	\N	MARIA Nguyễn Hoàng Anh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
797	\N	\N	GIUSE Đinh Gia Bảo	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
798	\N	\N	MARIA Phạm Phương Chi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
800	\N	\N	PHÊRÔ Nguyễn Hải Đăng	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
802	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
803	\N	\N	TÊRÊSA Nguyễn Thiên Hoa	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
804	\N	\N	VINHSƠN Phạm Gia Khiêm	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
806	\N	\N	PHÊRÔ Nguyễn Tuấn Kiệt	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
807	\N	\N	GIOAN B. Dương Hoàng Minh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
808	\N	\N	MARIA Vũ Phạm Khánh My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
809	\N	\N	MARIA Trương Hoàng Diễm My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
810	\N	\N	MARIA Dương Hà My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
811	\N	\N	Võ Nguyễn Khánh Ngọc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
812	\N	\N	MARIA Nguyễn Thảo Nguyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
813	\N	\N	Nguyễn Gia Nhi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
814	\N	\N	PHAOLÔ Nguyễn Quang Phúc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
815	\N	\N	MATTA Trương Nguyễn Hồng Phước	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
816	\N	\N	MARIA Nguyễn Huỳnh Quyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
817	\N	\N	GIOAN Lê Nguyễn Phúc Thịnh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
818	\N	\N	MARIA Trần Minh Trang Thư	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
819	\N	\N	PHÊRÔ Nguyễn Anh Tú	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
820	\N	\N	ANNA Nguyễn Ngọc Yến Vy	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
821	\N	\N	ANNA Võ Trần Như Ý	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
822	\N	\N	TÊRÊSA Nguyễn Hải Yến	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
823	\N	\N	MARIA Bùi Gia An	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
824	\N	\N	Trần Nguyễn Thiên Ân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
825	\N	\N	MICAE Nguyễn Quốc Bảo	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
826	\N	\N	MARIA Nguyễn Ngọc Thuỳ Dung	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
827	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
828	\N	\N	MARIA Nguyễn Thị Mỹ Hoà	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
829	\N	\N	MARIA Phạm Thiên Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
831	\N	\N	TÊRÊSA Bùi Quỳnh Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
832	\N	\N	GIUSE Mai Bảo Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
833	\N	\N	GIOAN PHAOLO Nguyễn Phúc Gia Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
834	\N	\N	ĐAMINH Tạ Minh Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
835	\N	\N	GIUSE Trần Nguyễn Bảo Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
836	\N	\N	GIUSE Vũ Quốc Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
837	\N	\N	PHÊRÔ Nguyễn Anh Khoa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
838	\N	\N	MARIA Lê Gia Linh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
839	\N	\N	GIUSE Nguyễn Thành Long	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
840	\N	\N	ANNA Nguyễn A My	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
841	\N	\N	GIÊRÔNIMÔ Trần Hoàng Nghĩa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
842	\N	\N	PHÊRÔ Nguyễn Hoàng Gia Phát	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
843	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
844	\N	\N	GIUSE Trần Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
845	\N	\N	GIUSE Vũ Minh Quân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
846	\N	\N	MARIA Đoàn Nhã Thi	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
847	\N	\N	ANNA Trương Thuỷ Tiên	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
848	\N	\N	ANTÔN Nguyễn Nguyên Trực	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
849	\N	\N	GIUSE Hồ Xuân Trường	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
850	\N	\N	MARIA Đỗ Ngọc Như Ý	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
851	\N	\N	MARIA Mai Vũ Ngọc Yến	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
852	\N	\N	GIUSE Đoàn Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
853	\N	\N	GIUSE Cao Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
854	\N	\N	FAUSTINA Võ Trần Ngọc An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
498	TN_THEMSUC2B_GQUW	3329157505522597888	ĐAMINH Nguyễn Việt Hoàng	THEMSUC2B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e3789e1e-7d15-4bfd-a9c0-d9e2fef5f3b1.jpg	SYNCED	2026-09-30 05:36:03.90906	2026-10-01 09:11:40.494607
783	\N	\N	ANNA Đõ Ánh Phi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
784	\N	\N	PHÊRÔ Phan Nguyễn Hoàng Phúc	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
786	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
855	\N	\N	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
856	\N	\N	ANNA Nguyễn Ngọc Diệu Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
857	\N	\N	PHÊRÔ Lưu Hoàng Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
858	\N	\N	MARIA Nguyễn Đặng Ngọc Ánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
859	\N	\N	PHÊRÔ Lê Nguyễn Thiên Bảo	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
860	\N	\N	GIUSE Võ Trần Tấn Bình	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
861	\N	\N	GIUSE Hồ Sỹ Minh Châu	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
862	\N	\N	PHÊRÔ Nguyên Hieu Duy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
863	\N	\N	GIUSE Trịnh Sơn Hải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
864	\N	\N	MARIA Nguyễn Lê Ngọc Hân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
865	\N	\N	ANNA Nguyễn Ngọc Quỳnh Hoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
867	\N	\N	MARIA Đỗ Quỳnh Hương	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
868	\N	\N	SIMON  Sơn Gia Huy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
869	\N	\N	PHÊRÔ Phạm Quang Khải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
870	\N	\N	GIOAN PHAOLÔ II Chu Nguyên Khang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
871	\N	\N	MARIA Nguyễn Ngọc Thiên Khánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
872	\N	\N	AUGUSTINÔ Nguyễn Trần Gia Khiêm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
873	\N	\N	PHANXICÔ Võ Lý Minh Khoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
874	\N	\N	PHÊRÔ Trần Nguyễn Nguyên Khôi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
875	\N	\N	GIUSE Nguyễn Tuấn Kiệt	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
876	\N	\N	Lại Bảo Lâm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
877	\N	\N	MARIA Vũ Phan Khánh Linh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
878	\N	\N	ANÊ Nguyễn Thị Thảo Nhi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
879	\N	\N	MARIA Phạm Cát An Nhiên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
880	\N	\N	ROSA Nguyễn Quỳnh Như	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
881	\N	\N	ANTÔN Trịnh Thanh Phong	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
882	\N	\N	AUGUSTINÔ Trần Văn Phúc	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
883	\N	\N	GIUSE Đinh Đặng Thiên Phước	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
884	\N	\N	CALORÔ Cao Nguyễn Hải Quân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
885	\N	\N	MARIA Phan Thị Như Quỳnh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
886	\N	\N	GIOAN Nguyễn Ngọc Thiện	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
887	\N	\N	MARIA Nguyễn Đặng Minh Trang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
888	\N	\N	GIUSE Vũ Thành Trung	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
889	\N	\N	GIUSE Nguyễn Tuấn Tú	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
890	\N	\N	MARIA Bùi Thị Nhã Uyên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
891	\N	\N	ANNA Nguyễn Thị Hải Yến	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
892	\N	\N	ANNA Trần Bạch Vy An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
893	\N	\N	ĐAMINH Tạ Phúc An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
894	\N	\N	PHÊRÔ Vũ Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
895	\N	\N	PHÊRÔ Danh Nguyễn Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
896	\N	\N	VICENTÊ ĐặngThiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
897	\N	\N	VICENTÊ Phạm Tuấn Anh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
898	\N	\N	PHÊRÔ Lê Nguyễn Gia Bảo	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
901	\N	\N	PHÊRÔ Lê Tấn Đạt	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
902	\N	\N	PHÊRÔ Nguyễn Đức Duy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
903	\N	\N	MARIA Nguyễn Ngọc Bảo Hân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
904	\N	\N	Phạm Huy Hoàng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
905	\N	\N	TÊRÊSA Nguyễn Ánh Hồng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
906	\N	\N	PHÊRÔ Phạm Văn Huy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
907	\N	\N	GIUSE Phạm Gia Khiêm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
908	\N	\N	PHILIPPHÊ Trần Đăng Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
801	TN_XUNGTOI2A_7K3S	3328969255352795136	MARIA Trương Gia Hân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/393cb3de-075c-428e-ae39-18c5ae3755dc.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.336677
805	TN_XUNGTOI2A_8YER	3328969797676302336	ĐAMINH Phạm Trung Kiên	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ab37d55b-74e1-4921-a1de-fb8d4bbad44b.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.342038
909	\N	\N	GIUSE Bùi Anh Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
910	\N	\N	ANRÊ Lê Đăng Khôi	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
911	\N	\N	MARIA PhạmThị Liên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
799	TN_XUNGTOI2A_6TTX	3328968970609885184	ANNA Nguyễn Phạm Thảo Chi	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/8716bf4d-c908-493c-8789-2f2652403f10.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.33181
866	\N	\N	Hà Gia Hưng	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
912	\N	\N	MARIA Phạm Trúc Linh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
913	\N	\N	INHAXIÔ Hoàng Đức Mạnh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
914	\N	\N	PHÊRÔ Nguyễn Nhật Minh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
915	\N	\N	MARIA Phạm Ngọc Khánh My	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
916	\N	\N	MARIA Nguyễn Khánh Ngân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
917	\N	\N	TÊRÊSA Nguyễn Bảo Ngọc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
918	\N	\N	GIUSE Nguyễn Hoàng Nhân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
919	\N	\N	MARIA Nguyễn An Nhiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
920	\N	\N	TÔMA Hoàng Minh Quân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
921	\N	\N	FAUSTINA Nguyễn Ngọc Đỗ Quyên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
922	\N	\N	ĐAMINH Đinh Trường Thành	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
923	\N	\N	GIUSE Phạm Minh Thiện	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
924	\N	\N	ANNA Huỳnh Anh Thư	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
925	\N	\N	MARIA Trần Thảo Tiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
926	\N	\N	MARIA Nguyễn Ngọc Bảo Trâm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
927	\N	\N	TÊRÊSA Trần Nguyễn Uyên Trinh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
928	\N	\N	ANNA Nguyễn Thanh Trúc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
929	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
930	\N	\N	MARIA Trần Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
931	\N	\N	MARIA Triệu Nguyễn Như Ý	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
932	\N	\N	MARIA Lâm Nguyễn Bảo An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
933	\N	\N	MARIA Vũ Thiên An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
934	\N	\N	MARTINÔ Phạm Nguyễn Bình An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
935	\N	\N	PHÊRÔ Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
937	\N	\N	MARIA Nguyễn Hoài Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
938	\N	\N	Hồ Việt Anh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
939	\N	\N	GIUSE Nguyễn Trần Hoàng Gia Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
940	\N	\N	PHÊRÔ Trần Nguyễn Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
941	\N	\N	GIOAN Phạm Lê Hải Đăng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
942	\N	\N	GIUSE Trần Quốc Đông	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
943	\N	\N	GIOAN Lê Dương Han	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
944	\N	\N	MARIA Nguyễn Ngọc Khánh Hân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
945	\N	\N	GIUSE Phạm Minh Hiền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
946	\N	\N	MARIA Trần Thái Hòa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
947	\N	\N	STÊPHANÔ Lê Thanh Nhật Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
948	\N	\N	PHÊRÔ Nguyễn Thái Tuấn Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
949	\N	\N	GIUSE Trần Bảo Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
950	\N	\N	GIUSE Trương Gia Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
951	\N	\N	PHAOLÔ Quang Đức Huy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
952	\N	\N	MARIA Phan Diệu Huyền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
953	\N	\N	GIUSE Nguyễn Lê Nhật Huynh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
954	\N	\N	PHÊRÔ Nguyễn Gia Khánh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
955	\N	\N	GIUSE Vũ Đăng Khoa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
956	\N	\N	ANRÊ Bùi Nhật Đăng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
957	\N	\N	VINHSƠN Lâm Hoàng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
966	\N	\N	GIUSE Hồ Xuân Nguyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
967	\N	\N	TÊRÊSA Nguyễn Ngọc An Nhiên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
968	\N	\N	GIUSE Lê Nguyễn Gia Phúc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
969	\N	\N	GIUSE Huỳnh Minh Sơn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
970	\N	\N	PHAOLÔ Ngô Huỳnh Thế Thiện	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
971	\N	\N	MARIA Trương Kiều Trang	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
972	\N	\N	CATARINA Đoàn Ngọc Khả Tú	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
973	\N	\N	ANNA Lê Nguyễn Nhã Uyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
974	\N	\N	GIUSE Nguyễn Minh Kiều Văn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
975	\N	\N	PHÊRÔ Bùi Tuấn Vũ	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
976	\N	\N	MARIA Phạm Trần Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
977	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
978	\N	\N	MARIA Trần Thị Cát Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
979	\N	\N	Đoàn Vũ Hải Yến	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
998	TN_GLV_U77E	\N	GIOAN Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	http://localhost:3000/uploads/processed_1790846647982_2.jpg	FAILED	2026-10-01 09:24:08.387174	2026-10-01 09:24:11.780118
899	\N	\N	PHÊRÔ Bùi Minh Bảo Cường	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
900	\N	\N	SIMON  Nguyễn Xuân Hoàng Đăng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
958	\N	\N	GIUSE Trần Đinh Nhật Long	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
959	\N	\N	TÊRÊSA Nguyễn Khánh Ly	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
960	\N	\N	ANNA Nguyễn Thị Trà My	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
961	\N	\N	ĐAMINH Lê Hồ Văn Nam	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
962	\N	\N	MARIA Ngô Hoàng Kim Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
963	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
964	\N	\N	TÊRÊSA Vũ Thiên Minh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
965	\N	\N	MARIA Trần Lê Khánh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
984	TN_THEMSUC2C_11JA	3331433337163087872	PHÊRÔ Lê Nguyễn Gia Huy	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/eb2d19b2-9bb9-49c2-9aec-da5e8340ed98.jpg	SYNCED	2026-09-30 12:03:15.129752	2026-10-01 09:11:40.547028
985	TN_THEMSUC1C_QIBI	3331470658163965952	MARIA Nguyễn Trần Lan Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/98a8796a-b739-466d-827b-b502d3e6f544.jpg	SYNCED	2026-09-30 13:17:24.203824	2026-10-01 09:11:40.551807
259	TN_GLV_FNWD	3318304752428646400	PHÊRÔ Trần Minh Mẫn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e29c5cb-4cc5-495b-ba6a-018b36eedbc6.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.043442
300	TN_GLV_SMY2	3318364624818012160	Võ Thị Mơ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/951128e7-0a60-4390-9b6a-29a4bc466779.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.067164
282	TN_GLV_089I	3323973138915524608	TÔMA AQUINÔ Trần Ngọc Bích	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e77d56df-1412-41ef-b15b-5c12cdc4360a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.231471
364	TN_THEMSUC1A_ZG1P	3326101836275908608	PHAOLÔ Lê Trần Thiên Ân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7d24f682-7fb6-4a0a-9970-1a67ed037b91.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.25282
383	TN_THEMSUC1A_EZB8	3326761102288617472	GIUSE Trần Gia Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ad19b3f4-fc82-4cb7-9b31-990ff87f510b.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.268063
795	TN_XUNGTOI2A_4BDI	3328968207531769856	TÊRÊSA Mai Vũ Hồng Ân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/106bc219-8050-435a-aa21-545689419ebe.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.325589
193	TN_BAODONG3_YS03	3328993938504679424	MATTA Vũ Thị Diệu Linh	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/782fa8e3-9be7-4e62-aca2-06aeb87de788.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.347448
382	TN_THEMSUC1A_5T0Y	3328996715687575552	GIOAN Nguyễn Viết Thiện Hữu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/39ffe66f-8c84-4007-b93f-5fcb383fb6bf.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.393465
983	TN_THEMSUC2C_ZYA1	3331391626789519360	MARIA Phạm Quỳnh Anh	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/065402bc-b1e2-401a-9095-b7ed39d7c046.jpg	SYNCED	2026-09-30 10:40:22.778248	2026-10-01 09:11:40.542214
986	TN_THEMSUC1C_REIQ	3331470946522365952	MARIA Phạm Vân Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1752645b-8360-442d-9ac5-ad2beca0f560.jpg	SYNCED	2026-09-30 13:17:58.531958	2026-10-01 09:11:40.556651
987	TN_THEMSUC1C_S9S3	3331471323414134784	PHÊRÔ Phạm Vũ Huy Khang	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7a6a3e21-d9b0-4de9-baad-752249a5c27b.jpg	SYNCED	2026-09-30 13:18:42.544005	2026-10-01 09:11:40.561245
990	TN_BAODONG2A_5B89	3331533535302385664	MARIA Hoàng Thị Kim Ngân	BAODONG2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0aef1cf8-0294-4fe3-b6e5-3191398e057a.jpg	SYNCED	2026-09-30 15:22:19.700252	2026-10-01 09:11:40.566107
991	TN_GLV_5CVP	3331942900354252800	TÔMA Hoàng Thành Lợi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/149e5092-039c-40a8-a231-95c6058507c9.jpg	SYNCED	2026-10-01 04:55:39.633953	2026-10-01 09:11:40.570958
992	TN_GLV_PPZD	3332005623570104320	Terexa Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/972dbdf3-8e14-40b3-bbf1-e13e136980c8.jpg	SYNCED	2026-10-01 07:00:16.559837	2026-10-01 09:11:40.576449
936	TN_XUNGTOI3C_SOIG	3329146769899520000	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3db68062-a76f-4492-9d12-e0c3e2fbe3c0.jpg	SYNCED	2026-09-30 05:36:04.506426	2026-10-01 09:11:40.488582
768	TN_XUNGTOI1B_ZVP4	3329248063356141568	VINHSƠN Phạm Gia Đạt	XUNGTOI1B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/5af00c44-a79a-486e-ab84-68c5120336b9.jpg	SYNCED	2026-09-30 05:36:04.260115	2026-10-01 09:11:40.502245
994	TN_THEMSUC_2C_RAUX	3330766809635749888	Phêrô NGUYỄN TRUNG HIẾU (thêm sức 2c	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e206de14-b2d1-4097-82eb-cb9c88ff3f78.jpg	SYNCED	2026-10-01 07:16:07.253109	2026-10-01 09:11:40.526458
995	TN_THEMSUC_2C_S0CZ	3330767313816256512	GIUSE Phan Quốc Huy	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ec6ecb28-2c31-4365-a083-44927f12389c.jpg	SYNCED	2026-10-01 07:16:07.261772	2026-10-01 09:11:40.532572
232	LM_DMHCCC_0AX6	3329318864474341376	GIUSE Nguyễn Quốc Tuấn	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/df99bbae-2f12-4ae9-bd1e-320df10e45e2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.64642
996	LM_DMHCCC_FV9O	3329888368933732352	Chú Long Lêgiô	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/0439bc4e-894a-4370-843d-d5a200759ecb.jpg	SYNCED	2026-10-01 07:16:07.373604	2026-10-01 09:11:40.657685
764	\N	\N	Trương Quốc Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 17, true);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 130, true);


--
-- Name: persons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.persons_id_seq', 998, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: persons persons_alias_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_alias_id_key UNIQUE (alias_id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_classes_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_classes_name ON public.classes USING btree (name);


--
-- Name: idx_persons_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_alias ON public.persons USING btree (alias_id);


--
-- Name: idx_persons_name_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_name_class ON public.persons USING btree (name, class_name);


--
-- Name: idx_persons_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_person_id ON public.persons USING btree (person_id);


--
-- Name: idx_persons_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_sync_status ON public.persons USING btree (sync_status);


--
-- Name: classes classes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: persons persons_class_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_class_name_fkey FOREIGN KEY (class_name) REFERENCES public.classes(name) ON DELETE SET NULL;


--
-- Name: persons persons_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ

