-- Create table
create table AGTDAT.CCINVOICED
(
  adresa        VARCHAR2(4000),
  brend         VARCHAR2(1000),
  chek          VARCHAR2(1000),
  cina          NUMBER,
  cinafull      NUMBER,
  cinazn        NUMBER,
  code_pal      VARCHAR2(10),
  dat           DATE,
  invcc         VARCHAR2(100),
  invkraina     VARCHAR2(20),
  invoper       VARCHAR2(500),
  invos         VARCHAR2(100),
  invtz         VARCHAR2(100),
  invvalut      VARCHAR2(100),
  kil           NUMBER,
  kod           NUMBER not null,
  kod_cc        NUMBER,
  kod_ccinvoice NUMBER,
  kod_kraina    NUMBER,
  kod_oper      NUMBER,
  kod_os        NUMBER,
  kod_tz        NUMBER,
  kod_valut     NUMBER,
  pdv           NUMBER,
  prim          VARCHAR2(4000),
  przn          NUMBER(5,2),
  station       VARCHAR2(100),
  suma          NUMBER,
  sumafull      NUMBER,
  sumazn        NUMBER,
  invpal        VARCHAR2(200),
  invrahnum     VARCHAR2(100),
  invrahdat     DATE,
  kod_shlz      NUMBER,
  isignore      NUMBER(1) default 0,
  nosyn         NUMBER(1) default 0,
  tofinzvit     NUMBER(1),
  kod_ccur      NUMBER,
  kod_shlzplan  NUMBER,
  zvitmis       DATE,
  datsyn        DATE,
  km            NUMBER,
  cctrans       VARCHAR2(100),
  invminus      NUMBER(1)
)
tablespace USERS
  pctfree 10
  initrans 1
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Add comments to the table 
comment on table AGTDAT.CCINVOICED
  is 'Записи інвойсу';
-- Add comments to the columns 
comment on column AGTDAT.CCINVOICED.adresa
  is 'Адреса';
comment on column AGTDAT.CCINVOICED.brend
  is 'Бренд';
comment on column AGTDAT.CCINVOICED.chek
  is '№ чека';
comment on column AGTDAT.CCINVOICED.cina
  is 'Ціна';
comment on column AGTDAT.CCINVOICED.cinafull
  is 'Ціна повна';
comment on column AGTDAT.CCINVOICED.cinazn
  is 'Ціна знижки';
comment on column AGTDAT.CCINVOICED.code_pal
  is 'Тип палива';
comment on column AGTDAT.CCINVOICED.dat
  is 'Дата';
comment on column AGTDAT.CCINVOICED.invcc
  is 'Інвойс, № КК';
comment on column AGTDAT.CCINVOICED.invkraina
  is 'Інвойс, країна';
comment on column AGTDAT.CCINVOICED.invoper
  is 'Інвойс, операція';
comment on column AGTDAT.CCINVOICED.invos
  is 'Інвойс, Особа';
comment on column AGTDAT.CCINVOICED.invtz
  is 'Інвойс, Транспортний засіб';
comment on column AGTDAT.CCINVOICED.invvalut
  is 'Інвойс, валюта';
comment on column AGTDAT.CCINVOICED.kil
  is 'К-ть';
comment on column AGTDAT.CCINVOICED.kod_cc
  is 'Кред. картка';
comment on column AGTDAT.CCINVOICED.kod_ccinvoice
  is 'Інвойс';
comment on column AGTDAT.CCINVOICED.kod_kraina
  is 'Країна';
comment on column AGTDAT.CCINVOICED.kod_oper
  is 'Операція по ШЛ';
comment on column AGTDAT.CCINVOICED.kod_os
  is 'Працівник';
comment on column AGTDAT.CCINVOICED.kod_tz
  is 'Автомобіль';
comment on column AGTDAT.CCINVOICED.kod_valut
  is 'Валюта';
comment on column AGTDAT.CCINVOICED.pdv
  is 'Величина ПДВ';
comment on column AGTDAT.CCINVOICED.prim
  is 'Примітки';
comment on column AGTDAT.CCINVOICED.przn
  is '% знижки';
comment on column AGTDAT.CCINVOICED.station
  is 'ID Станції';
comment on column AGTDAT.CCINVOICED.suma
  is 'Сума';
comment on column AGTDAT.CCINVOICED.sumafull
  is 'Сума повна';
comment on column AGTDAT.CCINVOICED.sumazn
  is 'Сума знижки';
comment on column AGTDAT.CCINVOICED.invpal
  is 'Інвойс, тип палива';
comment on column AGTDAT.CCINVOICED.invrahnum
  is 'Інвойс, № рах';
comment on column AGTDAT.CCINVOICED.invrahdat
  is 'Інвойс, Дата рах';
comment on column AGTDAT.CCINVOICED.kod_shlz
  is 'ШЛ, звіт';
comment on column AGTDAT.CCINVOICED.isignore
  is 'Ігнорувати';
comment on column AGTDAT.CCINVOICED.nosyn
  is 'Не синхронізовувати';
comment on column AGTDAT.CCINVOICED.tofinzvit
  is 'Додавати до фін.звіту';
comment on column AGTDAT.CCINVOICED.kod_ccur
  is 'Постачальник';
comment on column AGTDAT.CCINVOICED.kod_shlzplan
  is 'ШЛ, до якого треба було б привязати, та місяць закритий';
comment on column AGTDAT.CCINVOICED.zvitmis
  is 'Звітний місяць, якщо немає привязки';
comment on column AGTDAT.CCINVOICED.datsyn
  is 'Дата, час синхронізації';
comment on column AGTDAT.CCINVOICED.km
  is 'Км по інвойсу';
comment on column AGTDAT.CCINVOICED.cctrans
  is 'Транзакція по інвойсу (дата,час та кред картка)';
comment on column AGTDAT.CCINVOICED.invminus
  is 'Мінус сума';
-- Create/Recreate indexes 
create index AGTDAT.IDX_CCINVOICED_01 on AGTDAT.CCINVOICED (KOD_CC, DAT)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_02 on AGTDAT.CCINVOICED (CCTRANS)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_03 on AGTDAT.CCINVOICED (KOD_TZ, DAT)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_07 on AGTDAT.CCINVOICED (KOD_SHLZ, KOD_CC, KOD_OPER, DAT)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_08 on AGTDAT.CCINVOICED (KOD_CCINVOICE, DAT, KOD_TZ)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_09 on AGTDAT.CCINVOICED (KOD_SHLZ, KOD_CCUR, KOD_OPER, KOD_KRAINA, DAT)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
create index AGTDAT.IDX_CCINVOICED_10 on AGTDAT.CCINVOICED (KOD_SHLZ, TOFINZVIT)
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
-- Create/Recreate primary, unique and foreign key constraints 
alter table AGTDAT.CCINVOICED
  add constraint PK_CCINVOICED primary key (KOD)
  using index 
  tablespace USERS
  pctfree 10
  initrans 2
  maxtrans 255
  storage
  (
    initial 64K
    next 1M
    minextents 1
    maxextents unlimited
  );
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_01 foreign key (KOD_CCINVOICE)
  references AGTDAT.CCINVOICE (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_03 foreign key (KOD_VALUT)
  references AGTDAT.VALUT (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_04 foreign key (KOD_CC)
  references AGTDAT.CC (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_05 foreign key (KOD_TZ)
  references AGTDAT.TZ (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_06 foreign key (KOD_OS)
  references AGTDAT.OS (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_07 foreign key (KOD_OPER)
  references AGTDAT.SHLZOPER (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_08 foreign key (KOD_KRAINA)
  references AGTDAT.KRAINA (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_09 foreign key (KOD_SHLZ)
  references AGTDAT.SHLZ (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_10 foreign key (KOD_CCUR)
  references AGTDAT.CCUR (KOD);
alter table AGTDAT.CCINVOICED
  add constraint FK_CCINVOICED_11 foreign key (KOD_SHLZPLAN)
  references AGTDAT.SHLZ (KOD);
-- Grant/Revoke object privileges 
grant select, insert, update, delete on AGTDAT.CCINVOICED to ROLEAGTDAT;
