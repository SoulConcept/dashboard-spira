(() => {
  'use strict';

  const DATA = window.SPIRA_DATA;
  const DIGITAL = window.SPIRA_DIGITAL_DATA || { web:[], youtube:[], linkedin:[], competitors:[], quality:[], coverage:[], meta:{} };
  const COLORS = {
    red: DATA.brand.red,
    blue: DATA.brand.blue,
    yellow: DATA.brand.yellow,
    gray: DATA.brand.gray,
    muted: '#8B8E9D',
    light: '#E9EAF0',
    green: '#1D9D73',
    redSoft: '#F6A4AA',
    blueSoft: '#8490DF'
  };
  const countryColors = {
    Colombia: COLORS.blue,
    México: COLORS.red,
    Perú: COLORS.yellow,
    CAM: '#9AA7FF'
  };
  const monthNames = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthShortNames = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const viewMeta = {
    overview: { title: 'Resumen comercial', subtitle: 'Conversión, pipeline, leads y ventas con filtros dinámicos.' },
    ads: { title: 'Performance ADS', subtitle: 'Leads, inversión y eficiencia de campañas.' },
    investment: { title: 'Inversión ADS', subtitle: 'Presupuesto aprobado, ejecución y distribución por país.' },
    digital: { title: 'Canales digitales', subtitle: 'Histórico evolutivo y comparativo de Web, YouTube y LinkedIn.' }
  };

  const params = new URLSearchParams(location.search);
  const pathname = (location.pathname || '').toLowerCase();
  const defaultViewByPath = pathname.includes('canales') || pathname.includes('digital') ? 'digital' : pathname.includes('ads') ? 'ads' : pathname.includes('inversion') ? 'investment' : 'overview';
  const initialView = ['overview','ads','investment','digital'].includes(params.get('view')) ? params.get('view') : defaultViewByPath;
  const state = {
    view: initialView,
    year: params.get('year') === 'all' ? 'all' : (Number(params.get('year')) || 2026),
    adsYear: params.get('adsYear') === 'all' ? 'all' : (Number(params.get('adsYear')) || 'all'),
    overviewMonth: params.get('overviewMonth') === 'all' ? 'all' : (Number(params.get('overviewMonth')) || 'all'),
    adsMonth: params.get('adsMonth') === 'all' ? 'all' : (Number(params.get('adsMonth')) || 'all'),
    month: params.get('month') === 'all' ? 'all' : (Number(params.get('month')) || 'all'),
    country: params.get('country') || 'all',
    commercial: params.get('commercial') || 'all',
    digitalYear: params.get('digitalYear') === 'all' ? 'all' : (Number(params.get('digitalYear')) || 'all'),
    digitalMonth: params.get('digitalMonth') === 'all' ? 'all' : (Number(params.get('digitalMonth')) || 'all'),
    digitalChannel: params.get('digitalChannel') || 'all',
    digitalStatus: params.get('digitalStatus') || 'all',
    countryMode: 'chart',
    countryMetric: 'spent'
  };
  const charts = {};
  let toastTimer = null;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const totalSpend = row => (Number(row.linkedin) || 0) + (Number(row.google) || 0);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const number = (value, digits = 0) => new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
  const money = (value, digits = 0) => `USD ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0)}`;
  const percent = (value, digits = 1) => `${number(value, digits)}%`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function updateUrl() {
    const next = new URLSearchParams();
    next.set('view', state.view);
    if (state.view === 'ads') {
      next.set('adsYear', String(state.adsYear));
      next.set('adsMonth', String(state.adsMonth));
    } else if (state.view === 'digital') {
      next.set('digitalYear', String(state.digitalYear));
      next.set('digitalMonth', String(state.digitalMonth));
      if (state.digitalChannel !== 'all') next.set('digitalChannel', state.digitalChannel);
      if (state.digitalStatus !== 'all') next.set('digitalStatus', state.digitalStatus);
    } else {
      next.set('year', String(state.year));
      if (state.view === 'overview') next.set('overviewMonth', String(state.overviewMonth));
      if (state.view === 'investment') next.set('month', String(state.month));
    }
    if (state.view !== 'digital' && state.country !== 'all') next.set('country', state.country);
    if (state.view === 'overview' && state.commercial !== 'all') next.set('commercial', state.commercial);
    try { history.replaceState({}, '', `${location.pathname}?${next.toString()}`); } catch (_error) { /* file/data preview */ }
  }

  function destroyChart(name) {
    if (charts[name]) {
      charts[name].destroy();
      delete charts[name];
    }
  }

  function mountChart(name, selector, options) {
    destroyChart(name);
    const node = $(selector);
    if (!node) return;
    node.innerHTML = '';
    charts[name] = new ApexCharts(node, options);
    charts[name].render();
  }

  function baseChart(type, height = 310) {
    return {
      chart: {
        type,
        height,
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 550 },
        zoom: { enabled: false },
        foreColor: COLORS.gray
      },
      grid: { borderColor: '#ECEEF3', strokeDashArray: 4, padding: { left: 6, right: 12, top: 0, bottom: 0 } },
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth' },
      tooltip: { theme: 'light' },
      noData: { text: 'Sin datos para el filtro seleccionado', align: 'center', verticalAlign: 'middle', style: { color: COLORS.gray, fontSize: '12px' } }
    };
  }

  function metricCard({ label, value, icon, badge, foot, tone = 'red', footTone = '', emphasis = '' }) {
    const palette = {
      red: [COLORS.red, '#FFF0F1'],
      blue: [COLORS.blue, '#EEF0FF'],
      yellow: [COLORS.yellow, '#FFF5DF'],
      green: [COLORS.green, '#E9F8F3'],
      gray: [COLORS.gray, '#F1F1F3']
    }[tone] || [COLORS.red, '#FFF0F1'];
    const emphasisClass = emphasis ? ` metric-card--${escapeHtml(emphasis)}` : '';
    return `<article class="metric-card${emphasisClass}" style="--metric-color:${palette[0]};--metric-soft:${palette[1]}">
      <div class="metric-top"><span class="metric-icon"><i class="${icon}"></i></span><span class="metric-badge">${escapeHtml(badge)}</span></div>
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      <div class="metric-foot ${footTone}"><i class="${footTone === 'positive' ? 'ri-arrow-up-line' : footTone === 'negative' ? 'ri-arrow-down-line' : footTone === 'warning' ? 'ri-alert-line' : 'ri-information-line'}"></i><span>${escapeHtml(foot)}</span></div>
    </article>`;
  }

  function getYears() {
    return [...new Set(DATA.investment.history.map(row => row.year))].sort((a,b) => b-a);
  }

  function syncYearFilter() {
    const years = getYears();
    const options = `<option value="all">Todos</option>${years.map(year => `<option value="${year}">${year}</option>`).join('')}`;
    if (state.view === 'ads') {
      const valid = state.adsYear === 'all' || years.includes(Number(state.adsYear));
      if (!valid) state.adsYear = 'all';
      $('#yearFilter').innerHTML = options;
      $('#yearFilter').value = String(state.adsYear);
      return;
    }
    if (state.view === 'digital') {
      const digitalYears = [...new Set([...DIGITAL.web, ...DIGITAL.youtube, ...DIGITAL.linkedin].map(row => Number(row.year)).filter(Boolean))].sort((a,b)=>b-a);
      const digitalOptions = `<option value="all">Todos</option>${digitalYears.map(year => `<option value="${year}">${year}</option>`).join('')}`;
      const valid = state.digitalYear === 'all' || digitalYears.includes(Number(state.digitalYear));
      if (!valid) state.digitalYear = 'all';
      $('#yearFilter').innerHTML = digitalOptions;
      $('#yearFilter').value = String(state.digitalYear);
      return;
    }
    const valid = state.year === 'all' || years.includes(Number(state.year));
    if (!valid) state.year = years[0] || 'all';
    $('#yearFilter').innerHTML = options;
    $('#yearFilter').value = String(state.year);
  }

  function syncCommercialOptions() {
    const node = $('#commercialFilter');
    if (!node) return;
    const rows = (DATA.commercial.opportunities || []).filter(row => {
      const yearOk = state.year === 'all' || Number(row.year) === Number(state.year);
      const countryOk = state.country === 'all' || row.country === state.country;
      const monthOk = state.overviewMonth === 'all' || Number(row.monthIndex) === Number(state.overviewMonth);
      return yearOk && countryOk && monthOk;
    });
    const names = [...new Set(rows.map(row => row.commercial).filter(name => name && name !== 'Sin asignar'))]
      .sort((a,b) => a.localeCompare(b, 'es'));
    if (state.commercial !== 'all' && !names.includes(state.commercial)) state.commercial = 'all';
    node.innerHTML = `<option value="all">Todos</option>${names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}`;
    node.value = state.commercial;
  }

  function populateFilters() {
    $('#countryFilter').value = ['all','Colombia','México','Perú','CAM'].includes(state.country) ? state.country : 'all';
    syncYearFilter();
    syncMonthOptions();
    syncCommercialOptions();
  }

  function syncMonthOptions() {
    if (state.view === 'digital') {
      const html = `<option value="all">Todos</option>${monthNames.slice(1).map((month,index)=>`<option value="${index+1}">${month}</option>`).join('')}`;
      $('#monthFilter').innerHTML = html;
      $('#monthFilter').value = String(state.digitalMonth);
      return;
    }

    if (state.view === 'ads') {
      const periods = getPeriodsByYear(state.adsYear);
      const months = [...new Map(periods.map(period => [period.monthIndex, monthNames[period.monthIndex]])).entries()];
      if (state.adsMonth !== 'all' && !months.some(([index]) => Number(index) === Number(state.adsMonth))) state.adsMonth = 'all';
      $('#monthFilter').innerHTML = `<option value="all">Todos</option>${months.map(([index,label])=>`<option value="${index}">${label}</option>`).join('')}`;
      $('#monthFilter').value = String(state.adsMonth);
      return;
    }

    if (state.view === 'overview') {
      const rows = (DATA.commercial.opportunities || []).filter(row => state.year === 'all' || Number(row.year) === Number(state.year));
      const months = [...new Set(rows.map(row => Number(row.monthIndex)).filter(Boolean))].sort((a,b)=>a-b);
      if (state.overviewMonth !== 'all' && !months.includes(Number(state.overviewMonth))) state.overviewMonth = 'all';
      $('#monthFilter').innerHTML = `<option value="all">Todos</option>${months.map(index=>`<option value="${index}">${monthNames[index]}</option>`).join('')}`;
      $('#monthFilter').value = String(state.overviewMonth);
      return;
    }

    const rows = DATA.investment.history
      .filter(row => state.year === 'all' || row.year === Number(state.year))
      .sort((a,b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
    const uniqueMonths = [...new Map(rows.map(row => [row.monthIndex, row.month])).entries()].sort((a,b) => a[0]-b[0]);
    if (state.month !== 'all' && !uniqueMonths.some(([monthIndex]) => monthIndex === Number(state.month))) state.month = 'all';
    const html = `<option value="all">Todos</option>${uniqueMonths.map(([monthIndex, month]) => `<option value="${monthIndex}">${month}</option>`).join('')}`;
    $('#monthFilter').innerHTML = html;
    if ($('#countryMonthFilter')) $('#countryMonthFilter').innerHTML = html;
    $('#monthFilter').value = String(state.month);
    if ($('#countryMonthFilter')) $('#countryMonthFilter').value = String(state.month);
  }

  function setView(view, options = {}) {
    if (!viewMeta[view]) return;
    state.view = view;
    $$('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $$('[data-view-panel]').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    $('#pageTitle').textContent = viewMeta[view].title;
    $('#pageSubtitle').textContent = viewMeta[view].subtitle;
    $('#breadcrumbCurrent').textContent = viewMeta[view].title;
    $('#monthControl').style.display = '';
    const monthLabelNode = $('#monthControl span');
    if (monthLabelNode) monthLabelNode.textContent = view === 'overview' ? 'Mes comercial' : 'Mes';
    $('#yearControl').style.display = '';
    syncYearFilter();
    syncMonthOptions();
    $('#countryControl').style.display = view === 'digital' ? 'none' : '';
    $('#commercialControl').style.display = view === 'overview' ? '' : 'none';
    if (view === 'overview') syncCommercialOptions();
    if (!options.skipRender) renderCurrentView();
    updateUrl();
    closeSidebar();
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebarBackdrop').hidden = true;
  }

  function openSidebar() {
    $('#sidebar').classList.add('open');
    $('#sidebarBackdrop').hidden = false;
  }

  function commercialRowsByYear(rows) {
    return state.year === 'all' ? rows : rows.filter(row => Number(row.year) === Number(state.year));
  }

  function opportunityFlags(row) {
    const proposalValue = Number(row.proposalValue) || 0;
    const closeValue = Number(row.closeValue) || 0;
    const status = row.status || '';
    const final = proposalValue > 0 || closeValue > 0;
    const proposal = final || status === 'En propuesta' || status === 'No avanzo propuesta';
    const meeting = proposal || status === 'Reunión Inicial' || status === 'IDENTIFICACION DE NECESIDADES';
    const active = status.includes('Propuesta Final');
    // Regla de conciliación comercial: toda oportunidad cotizada que ya no está activa
    // se considera perdida. Las propuestas sin cotizar en "No avanzo propuesta" también
    // cuentan como perdidas, pero no suman valor al pipeline perdido.
    const lost = status === 'No avanzo propuesta' || (proposalValue > 0 && !active && closeValue <= 0);
    const close = closeValue > 0;
    return { meeting, proposal, final, active, lost, close };
  }

  function commercialOpportunityRows({ ignoreCommercial = false, ignoreCountry = false } = {}) {
    return (DATA.commercial.opportunities || []).filter(row => {
      const yearOk = state.year === 'all' || Number(row.year) === Number(state.year);
      const monthOk = state.overviewMonth === 'all' || Number(row.monthIndex) === Number(state.overviewMonth);
      const countryOk = ignoreCountry || state.country === 'all' || row.country === state.country;
      const commercialOk = ignoreCommercial || state.commercial === 'all' || row.commercial === state.commercial;
      return yearOk && monthOk && countryOk && commercialOk;
    });
  }

  function aggregateOpportunities(rows) {
    return rows.reduce((acc,row) => {
      const flags = opportunityFlags(row);
      const proposalValue = Number(row.proposalValue) || 0;
      const closeValue = Number(row.closeValue) || 0;
      acc.leads += 1;
      if (flags.meeting) acc.meetings += 1;
      if (flags.proposal) acc.proposals += 1;
      if (flags.final) acc.final += 1;
      if (flags.active) { acc.active += 1; acc.activeValue += proposalValue; }
      if (flags.lost) { acc.lost += 1; acc.lostUsd += proposalValue; }
      if (flags.close) { acc.closes += 1; acc.salesValue += closeValue; }
      acc.generated += proposalValue + closeValue;
      return acc;
    }, { leads:0, meetings:0, proposals:0, final:0, active:0, activeValue:0, lost:0, lostUsd:0, closes:0, salesValue:0, generated:0 });
  }

  function groupedCommercialRows() {
    const rows = commercialOpportunityRows();
    const countries = ['Colombia','México','Perú','CAM'];
    return countries.map(country => {
      const subset = rows.filter(row => row.country === country);
      const agg = aggregateOpportunities(subset);
      return {
        country,
        value: agg.activeValue,
        proposals: agg.active,
        avgTicket: agg.active ? agg.activeValue / agg.active : 0,
        generated: agg.generated,
        lost: agg.lostUsd,
        closes: agg.closes,
        salesValue: agg.salesValue,
        year: 2026
      };
    }).filter(row => row.value || row.proposals || row.closes || row.salesValue);
  }

  function filteredPipeline() {
    return groupedCommercialRows();
  }

  function filteredSales() {
    return groupedCommercialRows().map(row => ({ country:row.country, value:row.salesValue, closes:row.closes, year:row.year }));
  }

  function commercialFilterLabel() {
    const yearLabel = state.year === 'all' ? 'Todos los años' : String(state.year);
    const monthLabel = state.overviewMonth === 'all' ? '' : ` · ${monthNames[Number(state.overviewMonth)] || 'Mes'}`;
    const countryLabel = state.country === 'all' ? '' : ` · ${state.country}`;
    const commercialLabel = state.commercial === 'all' ? '' : ` · ${state.commercial}`;
    return `${yearLabel}${monthLabel}${countryLabel}${commercialLabel}`;
  }

  function filteredFunnelStages() {
    const rows = commercialOpportunityRows();
    const agg = aggregateOpportunities(rows);
    return DATA.commercial.funnel.map(stage => {
      if (stage.key === 'leads') return { ...stage, value: agg.leads, valueUsd: undefined };
      const value = Number(agg[stage.key]) || 0;
      const valueUsd = stage.key === 'lost' ? (Number(agg.lostUsd) || 0) : undefined;
      return { ...stage, value, valueUsd };
    });
  }

  // Periodos de Performance ADS: se derivan dinámicamente de investment.history
  // (siempre al día vía la sincronización automática desde Notion), en vez de una
  // lista de meses fija — así un mes nuevo aparece solo, sin tocar código.
  function getPeriodsByYear(yearFilter = state.adsYear) {
    const rows = (DATA.investment.history || [])
      .slice()
      .sort((a, b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
    const periods = rows.map(row => ({
      key: `${row.year}-${row.monthIndex}`,
      dataKey: `${row.year}-${row.monthIndex}`,
      label: row.month || monthNames[row.monthIndex],
      year: row.year,
      monthIndex: row.monthIndex
    }));
    return yearFilter === 'all' ? periods : periods.filter(period => period.year === Number(yearFilter));
  }

  function periodRangeLabel(yearFilter = state.adsYear) {
    if (yearFilter !== 'all') return String(yearFilter);
    const periods = getPeriodsByYear('all');
    if (!periods.length) return '';
    const fmt = period => `${monthShortNames[period.monthIndex]}. ${String(period.year).slice(-2)}`;
    return `${fmt(periods[0])}–${fmt(periods[periods.length - 1])}`;
  }

  function filterByYear(rows, yearFilter) {
    return yearFilter === 'all' ? rows : rows.filter(row => row.year === Number(yearFilter));
  }

  function filterByMonth(rows, monthFilter) {
    return monthFilter === 'all' ? rows : rows.filter(row => row.monthIndex === Number(monthFilter));
  }

  function formatPeriodLabel(rowOrPeriod, includeYear = false) {
    const monthText = rowOrPeriod.label || rowOrPeriod.month || monthNames[rowOrPeriod.monthIndex] || 'Mes';
    if (!includeYear) return monthText;
    return /20\d{2}/.test(monthText) ? monthText : `${monthText} ${rowOrPeriod.year}`;
  }

  function compactAxisLabel(rowOrPeriod, includeYear = false) {
    const monthText = monthShortNames[rowOrPeriod.monthIndex] || String(rowOrPeriod.month || rowOrPeriod.label || 'Mes').slice(0, 3);
    if (!includeYear) return monthText;
    const yearText = rowOrPeriod.year ? String(rowOrPeriod.year).slice(-2) : '';
    return yearText ? `${monthText} ${yearText}` : monthText;
  }

  // Leads por periodo: SIEMPRE se totalizan desde commercial.opportunities
  // (Listado de Leads entregados), la fuente correcta para totales por país,
  // comercial, funnel y pipeline. La "Tabla de control Leads #" es un archivo
  // de referencia manual y nunca debe sumarse aquí.
  function leadCountsByPeriod() {
    const map = {};
    (DATA.commercial.opportunities || []).forEach(opportunity => {
      if (opportunity.monthIndex == null || opportunity.year == null) return;
      const key = `${opportunity.year}-${opportunity.monthIndex}`;
      if (!map[key]) map[key] = { all: 0, byCountry: {} };
      map[key].all += 1;
      if (opportunity.country) {
        map[key].byCountry[opportunity.country] = (map[key].byCountry[opportunity.country] || 0) + 1;
      }
    });
    return map;
  }

  function leadRowsForYear(yearFilter = state.adsYear, countryFilter = state.country) {
    const periods = getPeriodsByYear(yearFilter);
    const counts = leadCountsByPeriod();
    return periods.map(period => {
      const bucket = counts[period.key] || { all: 0, byCountry: {} };
      const leads = countryFilter === 'all' ? bucket.all : (bucket.byCountry[countryFilter] || 0);
      return {
        key: period.key,
        label: formatPeriodLabel(period, yearFilter === 'all'),
        leads,
        year: period.year,
        monthIndex: period.monthIndex
      };
    });
  }

  // Lista de países con sus leads por periodo, también totalizados desde
  // commercial.opportunities (ver leadCountsByPeriod). Reemplaza el antiguo
  // DATA.ads.countries (tabla de control manual, congelada).
  function countryLeadRows(yearFilter = state.adsYear) {
    const periods = getPeriodsByYear(yearFilter);
    const counts = leadCountsByPeriod();
    const countries = Object.keys(DATA.commercial.funnelByCountry || {});
    return countries.map(country => {
      const row = { country };
      periods.forEach(period => {
        const bucket = counts[period.key];
        row[period.key] = bucket ? (bucket.byCountry[country] || 0) : 0;
      });
      return row;
    });
  }

  function investmentRowsForYear(yearFilter = state.adsYear, countryFilter = state.country) {
    const source = countryFilter === 'all'
      ? (DATA.investment.history || [])
      : (DATA.investment.countryHistory || []).filter(row => row.country === countryFilter);
    return source
      .filter(row => yearFilter === 'all' || row.year === Number(yearFilter))
      .sort((a,b) => (a.year * 12 + (a.monthIndex || 0)) - (b.year * 12 + (b.monthIndex || 0)))
      .map(row => ({ ...row, label: formatPeriodLabel(row, yearFilter === 'all') }));
  }

  function adsPeriods() {
    return filterByMonth(getPeriodsByYear(state.adsYear), state.adsMonth);
  }

  function adsPeriodLabel() {
    const yearLabel = periodRangeLabel(state.adsYear);
    const monthLabel = state.adsMonth === 'all' ? '' : ` · ${monthNames[Number(state.adsMonth)] || 'Mes'}`;
    return `${yearLabel}${monthLabel}`;
  }

  function adsLeadRows() {
    return filterByMonth(leadRowsForYear(state.adsYear, state.country), state.adsMonth);
  }

  function adsInvestmentRows() {
    return filterByMonth(investmentRowsForYear(state.adsYear, state.country), state.adsMonth);
  }

  function overviewLeadRows() {
    return commercialOpportunityRows();
  }

  function overviewInvestmentRows() {
    return filterByMonth(investmentRowsForYear(state.year, state.country), state.overviewMonth);
  }

  function investmentRows() {
    const source = state.country === 'all'
      ? DATA.investment.history
      : DATA.investment.countryHistory.filter(row => row.country === state.country);
    return filterByMonth(filterByYear(source, state.year), state.month)
      .sort((a,b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
  }

  function countryInvestmentRows() {
    const rows = filterByMonth(filterByYear(DATA.investment.countryHistory, state.year), state.month)
      .filter(row => state.country === 'all' || row.country === state.country);
    const grouped = new Map();
    rows.forEach(row => {
      const current = grouped.get(row.country) || { country: row.country, budget: 0, linkedin: 0, google: 0, leads: 0 };
      current.budget += Number(row.budget) || 0;
      current.linkedin += Number(row.linkedin) || 0;
      current.google += Number(row.google) || 0;
      current.leads += Number(row.leads) || 0;
      grouped.set(row.country, current);
    });
    const order = ['Colombia','México','Perú','CAM'];
    return [...grouped.values()].sort((a,b) => order.indexOf(a.country) - order.indexOf(b.country));
  }

  function countryTrendRows() {
    return filterByMonth(
      filterByYear(DATA.investment.countryHistory, state.year)
        .filter(row => state.country === 'all' || row.country === state.country),
      state.month
    ).sort((a,b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
  }

  function investmentFilterBadge() {
    const yearLabel = state.year === 'all' ? 'Todos los años' : String(state.year);
    const monthLabel = state.month === 'all' ? 'Todos los meses' : monthNames[Number(state.month)] || 'Mes';
    return `${yearLabel} · ${monthLabel}`;
  }

  function renderCurrentView() {

    if (state.view === 'overview') renderOverview();
    else if (state.view === 'ads') renderAds();
    else if (state.view === 'digital') renderDigital();
    else renderInvestment();
  }

  function renderOverview() {
    renderOverviewMetrics();
    renderFunnel();
    renderPipelineGenerated();
    renderPipeline();
    renderSales();
    renderPipelineTable();
    renderCommercialBreakdown();
  }

  function renderOverviewMetrics() {
    const pipeline = filteredPipeline();
    const sales = filteredSales();
    const commercialScoped = state.commercial !== 'all';
    const pipelineValue = sum(pipeline, 'value');
    const proposals = sum(pipeline, 'proposals');
    const salesValue = sum(sales, 'value');
    const closes = sum(sales, 'closes');
    const generatedPipeline = sum(pipeline, 'generated');
    const overallActivePipeline = aggregateOpportunities(commercialOpportunityRows({ ignoreCommercial:true })).activeValue;
    const share = overallActivePipeline ? pipelineValue / overallActivePipeline * 100 : 0;
    const leads = commercialOpportunityRows().length;
    const investmentRows = overviewInvestmentRows();
    const adsInvestment = commercialScoped ? 0 : investmentRows.reduce((total, row) => total + totalSpend(row), 0);
    const qualifiedLeadRows = filterByMonth(leadRowsForYear(state.year, state.country), state.overviewMonth);
    const qualifiedLeads = sum(qualifiedLeadRows, 'leads');
    const cpl = !commercialScoped && qualifiedLeads ? adsInvestment / qualifiedLeads : 0;
    const roas = !commercialScoped && adsInvestment ? salesValue / adsInvestment : 0;
    const conversion = leads ? closes / leads * 100 : 0;
    const periodText = `${state.year === 'all' ? 'Todos' : state.year}${state.overviewMonth === 'all' ? '' : ` · ${monthShortNames[Number(state.overviewMonth)]}`}`;
    const baseBadge = state.country === 'all' ? periodText : `${state.country} · ${periodText}`;
    const badge = commercialScoped ? state.commercial : baseBadge;
    const overviewMetrics = $('#overviewMetrics');
    overviewMetrics.dataset.count = '6';
    overviewMetrics.innerHTML = [
      metricCard({ label:'Pipeline activo', value:money(pipelineValue), icon:'ri-funds-line', badge:pipeline.length ? (commercialScoped ? state.commercial : state.country === 'all' ? `${pipeline.length} mercados` : state.country) : 'Sin pipeline', foot:pipelineValue ? `${percent(share)} del pipeline filtrado · ${money(generatedPipeline)} generados` : 'Sin pipeline comercial en el periodo', tone:'blue', footTone:pipelineValue ? 'positive' : '', emphasis:'pipeline' }),
      metricCard({ label:'Ventas cerradas', value:money(salesValue), icon:'ri-hand-coin-line', badge:`${closes} cierres`, foot:closes ? `Conversión sobre leads ${percent(conversion)}` : 'Sin ventas cerradas en el periodo', tone:'green', footTone:closes ? 'positive' : '' }),
      metricCard({ label:'Leads entregados', value:number(leads), icon:'ri-user-add-line', badge:badge, foot:commercialScoped ? 'Registros asignados al comercial en Notion' : `Inversión asociada ${money(adsInvestment,2)}`, tone:'yellow', footTone:'warning' }),
      metricCard({ label:'Propuestas activas', value:number(proposals), icon:'ri-file-list-3-line', badge:'Potencial', foot:proposals ? `Ticket medio ${money(pipelineValue/proposals)}` : 'Sin propuestas activas en el periodo', tone:'red' }),
      commercialScoped
        ? metricCard({ label:'Costo por lead', value:'No atribuible', icon:'ri-focus-3-line', badge:'Por comercial', foot:'La inversión ADS no está etiquetada por comercial', tone:'gray' })
        : metricCard({ label:'Costo por lead', value:qualifiedLeads ? money(cpl,2) : 'Sin dato', icon:'ri-focus-3-line', badge:'CPL', foot:`${number(qualifiedLeads)} leads calificados considerados`, tone:'gray' }),
      commercialScoped
        ? metricCard({ label:'ROAS publicitario', value:'No atribuible', icon:'ri-line-chart-line', badge:'Por comercial', foot:'La inversión ADS está disponible por país, no por comercial', tone:'gray' })
        : metricCard({ label:'ROAS publicitario', value:adsInvestment ? `${number(roas,2)}x` : 'Sin dato', icon:'ri-line-chart-line', badge:'ROAS', foot:adsInvestment ? `USD 1 invertido genera USD ${number(roas,2)} en ventas` : 'Ventas divididas entre inversión ADS', tone:roas >= 1 ? 'blue' : 'red', footTone:roas >= 1 ? 'positive' : 'negative' })
    ].join('');
  }

  function renderFunnel() {

    const stages = filteredFunnelStages();
    const periodBadge = $('#funnelPeriodBadge');
    if (periodBadge) periodBadge.textContent = commercialFilterLabel();
    const stageColors = ['#CDD6FF', COLORS.yellow, '#F0B857', COLORS.blue, COLORS.red, COLORS.gray, COLORS.green];
    const container = $('#funnelChart');
    destroyChart('funnel');

    const leadCount = stages[0]?.value || 0;
    const meetingsCount = stages[1]?.value || 0;
    const proposalsCount = stages[2]?.value || 0;

    const funnelRules = [
      { base: leadCount || 1, label: 'Etapa base', formula: 'Leads entregados' },
      { base: leadCount || 1, label: 'Cálculo', formula: 'Reuniones / leads entregados' },
      { base: meetingsCount || 1, label: 'Cálculo', formula: 'Propuestas / reuniones' },
      { base: meetingsCount || 1, label: 'Cálculo', formula: 'Propuesta final / reuniones' },
      { base: meetingsCount || 1, label: 'Cálculo', formula: 'Propuestas activas / reuniones' },
      { base: proposalsCount || 1, label: 'Cálculo', formula: 'Perdidos / propuestas' },
      { base: proposalsCount || 1, label: 'Cálculo', formula: 'Cierres / propuestas' }
    ];

    const rowsHtml = stages.map((stage, index) => {
      const totalRate = leadCount ? stage.value / leadCount * 100 : 0;
      const effectiveRate = index === 0 ? 100 : (funnelRules[index].base ? stage.value / funnelRules[index].base * 100 : 0);
      const amount = stage.valueUsd ? `<span>Monto asociado <strong>${money(stage.valueUsd)}</strong></span>` : '';
      const conversionNote = index === 0 ? 'Etapa base' : `${percent(effectiveRate)} conversión según la fórmula definida`;
      return `<div class="funnel-row-wrap">
        <button class="funnel-row" type="button" data-stage-index="${index}" aria-expanded="false" aria-label="${escapeHtml(stage.label)}: ${number(stage.value)}. Conversión ${percent(effectiveRate)}. Participación sobre leads ${percent(totalRate)}.">
          <span class="funnel-row-name">${escapeHtml(stage.label)}</span>
          <span class="funnel-track">
            <span class="funnel-bar" style="--bar-width:${clamp(totalRate, 0, 100)}%;--bar-color:${stageColors[index]}"></span>
          </span>
          <span class="funnel-row-value"><strong>${number(stage.value)}</strong><small>${percent(effectiveRate)}</small></span>
        </button>
        <div class="funnel-detail" data-stage-detail="${index}" hidden>
          <span>${funnelRules[index].label} <strong>${escapeHtml(funnelRules[index].formula)}</strong></span>
          <span>Conversión de esta etapa <strong>${percent(effectiveRate)}</strong></span>
          <span>Participación sobre leads <strong>${percent(totalRate)}</strong></span>
          ${amount}
        </div>
      </div>`;
    }).join('');

    container.innerHTML = `<div class="funnel-html-chart">
      <div class="funnel-rows">${rowsHtml}</div>
      <div class="funnel-axis" aria-hidden="true">
        <span></span>
        <div class="funnel-axis-scale"><span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span><span>100%</span></div>
        <span></span>
      </div>
    </div>`;

    $$('.funnel-row', container).forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.stageIndex);
        const detail = $(`[data-stage-detail="${index}"]`, container);
        const isOpen = button.getAttribute('aria-expanded') === 'true';
        $$('.funnel-row', container).forEach(item => {
          item.classList.remove('active');
          item.setAttribute('aria-expanded', 'false');
        });
        $$('[data-stage-detail]', container).forEach(item => { item.hidden = true; });
        if (!isOpen) {
          button.classList.add('active');
          button.setAttribute('aria-expanded', 'true');
          detail.hidden = false;
        }
      });
    });
  }

  function pipelineGeneratedPeriods() {
    const sourceRows = (DATA.commercial.opportunities || []).filter(row => {
      const yearOk = state.year === 'all' || Number(row.year) === Number(state.year);
      const monthOk = state.overviewMonth === 'all' || Number(row.monthIndex) === Number(state.overviewMonth);
      return yearOk && monthOk && Number(row.monthIndex) >= 1 && Number(row.monthIndex) <= 12;
    });
    return [...new Map(sourceRows.map(row => {
      const key = `${row.year}-${row.monthIndex}`;
      return [key, { key, year:Number(row.year), monthIndex:Number(row.monthIndex) }];
    })).values()].sort((a,b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
  }

  function pipelineGeneratedMatrix() {
    const periods = pipelineGeneratedPeriods();
    const rows = commercialOpportunityRows();
    const countries = state.country === 'all' ? ['Colombia','México','Perú','CAM'] : [state.country];
    const data = periods.map(period => {
      const periodRows = rows.filter(row => Number(row.year) === period.year && Number(row.monthIndex) === period.monthIndex);
      const values = Object.fromEntries(countries.map(country => {
        const generated = periodRows
          .filter(row => row.country === country)
          .reduce((total,row) => total + (Number(row.proposalValue)||0) + (Number(row.closeValue)||0), 0);
        return [country, generated];
      }));
      const total = Object.values(values).reduce((sum,value) => sum + (Number(value)||0), 0);
      const leads = periodRows.length;
      const valuedOpportunities = periodRows.filter(row => (Number(row.proposalValue)||0) > 0 || (Number(row.closeValue)||0) > 0).length;
      const avgTicket = valuedOpportunities ? total / valuedOpportunities : 0;
      const label = state.year === 'all' ? `${monthShortNames[period.monthIndex]} ${String(period.year).slice(-2)}` : monthShortNames[period.monthIndex];
      return { ...period, label, values, total, leads, valuedOpportunities, avgTicket };
    });
    return { periods:data, countries };
  }

  function renderPipelineGenerated() {
    const chartNode = $('#pipelineGeneratedChart');
    const tableNode = $('#pipelineGeneratedTable');
    const tableHead = $('#pipelineGeneratedTableHead');
    const tableFoot = $('#pipelineGeneratedTableFoot');
    const badge = $('#pipelineGeneratedTotalBadge');
    const support = $('#pipelineGeneratedSupport');
    if (!chartNode || !tableNode) return;

    const { periods, countries } = pipelineGeneratedMatrix();
    const totalGenerated = periods.reduce((sum,row) => sum + row.total, 0);
    if (badge) badge.textContent = money(totalGenerated);
    if (support) {
      const commercialText = state.commercial === 'all' ? 'Todos los comerciales' : state.commercial;
      const countryText = state.country === 'all' ? 'Todos los países' : state.country;
      support.textContent = `Mes = fecha de envío a comercial · ${commercialText} · ${countryText}. Leads = registros enviados en el período. Ticket promedio = pipeline generado / oportunidades con valor comercial.`;
    }

    const options = baseChart('bar', 350);
    Object.assign(options, {
      series: countries.map(country => ({ name:country, data:periods.map(row => Number(row.values[country]) || 0) })),
      colors: countries.map(country => countryColors[country]),
      chart: { ...options.chart, type:'bar', height:350, stacked:true, parentHeightOffset:0 },
      grid: { ...options.grid, padding:{left:8,right:8,top:34,bottom:0} },
      plotOptions: {
        bar: {
          horizontal:false,
          borderRadius:5,
          columnWidth:'56%',
          dataLabels:{
            total:{
              enabled:true,
              offsetY:-6,
              style:{fontSize:'11px',fontWeight:800,color:COLORS.gray},
              formatter:value => value ? `${number(value/1000)}K` : ''
            }
          }
        }
      },
      xaxis: {
        categories: periods.map(row => row.label),
        axisBorder:{show:false},
        axisTicks:{show:false},
        labels:{style:{fontWeight:800,fontSize:'11px',colors:periods.map(()=>COLORS.gray)}}
      },
      yaxis: {
        min:0,
        labels:{formatter:value=>value>=1000?`${number(value/1000)}K`:number(value),style:{fontSize:'11px',fontWeight:700,colors:[COLORS.gray]}}
      },
      dataLabels:{enabled:false},
      legend:{show:true,position:'bottom',horizontalAlign:'center',fontSize:'11px',fontWeight:700,markers:{width:8,height:8,radius:8}},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>money(value)}},
      noData:{text:'Sin pipeline generado para el filtro seleccionado'}
    });
    mountChart('pipelineGenerated','#pipelineGeneratedChart',options);

    if (tableHead) tableHead.innerHTML = `<th>Mes</th><th class="pipeline-leads-col">Leads del mes</th>${countries.map(country=>`<th>${escapeHtml(country)}</th>`).join('')}<th>Total generado</th><th class="pipeline-ticket-col">Ticket promedio</th>`;
    tableNode.innerHTML = periods.length ? periods.map(row => `<tr><td><strong>${monthNames[row.monthIndex]}${state.year==='all'?` ${row.year}`:''}</strong></td><td class="pipeline-leads-col"><strong>${number(row.leads)}</strong></td>${countries.map(country=>`<td>${money(row.values[country])}</td>`).join('')}<td class="pipeline-total-col"><strong>${money(row.total)}</strong></td><td class="pipeline-ticket-col"><strong>${money(row.avgTicket)}</strong></td></tr>`).join('') : `<tr><td colspan="${countries.length+4}">No se encontró pipeline generado para el filtro seleccionado.</td></tr>`;
    if (tableFoot) {
      const countryTotals = Object.fromEntries(countries.map(country => [country, periods.reduce((sum,row)=>sum+(Number(row.values[country])||0),0)]));
      const totalLeads = periods.reduce((sum,row)=>sum+(Number(row.leads)||0),0);
      const totalValuedOpportunities = periods.reduce((sum,row)=>sum+(Number(row.valuedOpportunities)||0),0);
      const overallAvgTicket = totalValuedOpportunities ? totalGenerated / totalValuedOpportunities : 0;
      tableFoot.innerHTML = periods.length ? `<tr><td>TOTAL</td><td class="pipeline-leads-col">${number(totalLeads)}</td>${countries.map(country=>`<td>${money(countryTotals[country])}</td>`).join('')}<td class="pipeline-total-col">${money(totalGenerated)}</td><td class="pipeline-ticket-col">${money(overallAvgTicket)}</td></tr>` : '';
    }
  }

  function renderPipeline() {
    const rows = filteredPipeline();
    const total = sum(rows,'value');
    const generated = sum(rows,'generated');
    const lost = sum(rows,'lost');
    const maxValue = Math.max(...rows.map(row=>row.value),1);
    $('#pipelineTotalBadge').textContent = money(total);
    const support = $('#pipelineSupport');
    if (support) support.textContent = rows.length ? `Pipeline generado: ${money(generated)} · Pipeline perdido: ${money(lost)}` : `Sin pipeline comercial en ${commercialFilterLabel()}`;
    const options = baseChart('bar',330);
    Object.assign(options,{
      series:[{name:'Pipeline',data:rows.map(row=>row.value)}],
      colors:rows.map(row=>countryColors[row.country]),
      chart:{...options.chart,type:'bar',height:330,parentHeightOffset:0},
      grid:{...options.grid,padding:{left:8,right:8,top:50,bottom:0}},
      plotOptions:{
        bar:{
          distributed:true,
          borderRadius:8,
          columnWidth:'48%',
          dataLabels:{position:'top'}
        }
      },
      xaxis:{
        categories:rows.map(row=>row.country),
        axisBorder:{show:false},
        axisTicks:{show:false},
        labels:{style:{fontWeight:800,fontSize:'12px',colors:rows.map(()=>COLORS.gray)}}
      },
      yaxis:{
        min:0,
        max:Math.ceil((maxValue*1.3)/50000)*50000,
        tickAmount:4,
        labels:{formatter:value=>`${number(value/1000)}K`,style:{fontSize:'11px',fontWeight:700,colors:[COLORS.gray]}}
      },
      dataLabels:{
        enabled:true,
        offsetY:-22,
        formatter:value=>`${number(value/1000)}K`,
        style:{fontSize:'11px',fontWeight:850,colors:[COLORS.gray]},
        background:{enabled:false},
        dropShadow:{enabled:false}
      },
      legend:{show:false},
      tooltip:{followCursor:true,y:{formatter:value=>money(value)}}
    });
    mountChart('pipeline','#pipelineChart',options);
  }

  function renderSales() {
    const rows = filteredSales();
    const nonZero = rows.filter(row => row.value > 0);
    const values = nonZero.map(row => row.value);
    const options = baseChart('donut', 255);
    Object.assign(options, {
      series: values,
      labels: nonZero.map(row => row.country),
      colors: nonZero.map(row => countryColors[row.country]),
      chart: { ...options.chart, type:'donut', height:255 },
      stroke: { width:4, colors:['#fff'] },
      plotOptions: { pie:{ donut:{ size:'70%', labels:{ show:true, name:{show:true,fontSize:'12px'}, value:{show:true,fontSize:'19px',fontWeight:800,formatter:value => money(value)}, total:{show:true,label:'Ventas',fontSize:'11px',formatter:() => money(sum(nonZero,'value'))} } } } },
      legend:{show:false},
      tooltip:{y:{formatter:value => money(value)}}
    });
    mountChart('sales', '#salesChart', options);
    const total = sum(nonZero,'value');
    $('#salesLegend').innerHTML = nonZero.map(row => `<div class="legend-line" style="--legend-color:${countryColors[row.country]}"><i></i><span>${row.country} · ${row.closes} cierre${row.closes===1?'':'s'}</span><strong>${money(row.value)} · ${percent(total?row.value/total*100:0)}</strong></div>`).join('') || '<p class="data-footnote">Sin ventas para el filtro seleccionado.</p>';
  }

  function renderPipelineTable() {
    const salesMap = Object.fromEntries(filteredSales().map(row => [row.country,row]));
    const rows = filteredPipeline();
    const overall = sum(rows,'value');
    $('#pipelineTable').innerHTML = rows.map(row => {
      const sales = salesMap[row.country] || {closes:0,value:0};
      const share = overall ? row.value/overall*100 : 0;
      const totalCommercialValue = (Number(row.value)||0) + (Number(sales.value)||0);
      return `<tr><td><strong>${row.country}</strong></td><td>${money(row.value)}</td><td><div class="share-cell"><span>${percent(share)}</span><span class="share-bar"><i style="width:${clamp(share,0,100)}%"></i></span></div></td><td>${number(row.proposals)}</td><td>${money(row.avgTicket)}</td><td>${number(sales.closes)}</td><td>${money(sales.value)}</td><td><strong>${money(totalCommercialValue)}</strong></td></tr>`;
    }).join('') || '<tr><td colspan="8">No se encontraron resultados.</td></tr>';

    const totalProposals = sum(rows,'proposals');
    const totalCloses = Object.values(salesMap).reduce((total,row)=>total+(Number(row.closes)||0),0);
    const totalSales = Object.values(salesMap).reduce((total,row)=>total+(Number(row.value)||0),0);
    const totalCommercialValue = overall + totalSales;
    const foot = $('#pipelineTableFoot');
    if (foot) foot.innerHTML = rows.length ? `<tr><td>TOTAL REGIONAL</td><td>${money(overall)}</td><td>${percent(overall?100:0)}</td><td>${number(totalProposals)}</td><td>${totalProposals?money(overall/totalProposals):'—'}</td><td>${number(totalCloses)}</td><td>${money(totalSales)}</td><td>${money(totalCommercialValue)}</td></tr>` : '';
  }

  function renderCommercialBreakdown() {
    const target = $('#commercialBreakdownTable');
    const foot = $('#commercialBreakdownFoot');
    const note = $('#commercialBreakdownNote');
    if (!target) return;

    try {
      const sourceRows = Array.isArray(DATA.commercial.opportunities) ? DATA.commercial.opportunities : [];
      const rows = sourceRows.filter(row => {
        const yearOk = state.year === 'all' || Number(row.year) === Number(state.year);
        const monthOk = state.overviewMonth === 'all' || Number(row.monthIndex) === Number(state.overviewMonth);
        const countryOk = state.country === 'all' || row.country === state.country;
        return yearOk && monthOk && countryOk;
      });
      const namedRows = rows.filter(row => typeof row.commercial === 'string' && row.commercial.trim().length > 0);
      const commercialNames = Array.from(new Set(namedRows.map(row => String(row.commercial).trim())))
        .filter(name => state.commercial === 'all' || name === state.commercial);

      const matrix = commercialNames.map(name => {
        const subset = namedRows.filter(row => String(row.commercial).trim() === name);
        const agg = aggregateOpportunities(subset);
        const countryCounts = { Colombia:0, 'México':0, 'Perú':0, CAM:0 };
        subset.forEach(row => {
          const flags = opportunityFlags(row);
          if (flags.active && Object.prototype.hasOwnProperty.call(countryCounts, row.country)) countryCounts[row.country] += 1;
        });
        return { name, ...agg, countryCounts };
      }).sort((a,b) => {
        if (b.activeValue !== a.activeValue) return b.activeValue - a.activeValue;
        if (b.active !== a.active) return b.active - a.active;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });

      if (!matrix.length) {
        target.innerHTML = '<tr><td colspan="10">No se encontraron oportunidades para el filtro seleccionado.</td></tr>';
        if (foot) foot.innerHTML = '';
      } else {
        target.innerHTML = matrix.map(row => `<tr>
          <td><strong>${escapeHtml(row.name)}</strong></td>
          <td><span class="opportunity-count">${number(row.countryCounts.Colombia)}</span></td>
          <td><span class="opportunity-count">${number(row.countryCounts['México'])}</span></td>
          <td><span class="opportunity-count">${number(row.countryCounts['Perú'])}</span></td>
          <td><span class="opportunity-count">${number(row.countryCounts.CAM)}</span></td>
          <td><strong>${number(row.active)}</strong></td>
          <td>${money(row.activeValue)}</td>
          <td>${row.active ? money(row.activeValue/row.active) : '—'}</td>
          <td>${number(row.closes)}</td>
          <td>${money(row.salesValue)}</td>
        </tr>`).join('');

        const totals = matrix.reduce((acc,row) => {
          acc.colombia += Number(row.countryCounts.Colombia) || 0;
          acc.mexico += Number(row.countryCounts['México']) || 0;
          acc.peru += Number(row.countryCounts['Perú']) || 0;
          acc.cam += Number(row.countryCounts.CAM) || 0;
          acc.active += Number(row.active) || 0;
          acc.activeValue += Number(row.activeValue) || 0;
          acc.closes += Number(row.closes) || 0;
          acc.salesValue += Number(row.salesValue) || 0;
          return acc;
        }, {colombia:0,mexico:0,peru:0,cam:0,active:0,activeValue:0,closes:0,salesValue:0});

        if (foot) foot.innerHTML = `<tr><td>TOTAL</td><td>${number(totals.colombia)}</td><td>${number(totals.mexico)}</td><td>${number(totals.peru)}</td><td>${number(totals.cam)}</td><td>${number(totals.active)}</td><td>${money(totals.activeValue)}</td><td>${totals.active?money(totals.activeValue/totals.active):'—'}</td><td>${number(totals.closes)}</td><td>${money(totals.salesValue)}</td></tr>`;
      }

      if (note) {
        if (state.commercial !== 'all') {
          note.textContent = `Vista filtrada por ${state.commercial}. Las columnas muestran únicamente oportunidades activas atribuidas a ese comercial.`;
        } else if (state.country !== 'all') {
          note.textContent = `Vista de ${state.country}. Todas las oportunidades activas y su pipeline están atribuidos a un comercial en el corte actual.`;
        } else {
          note.textContent = `Las columnas por país muestran propuestas activas por comercial. El total de ${number(matrix.reduce((sum,row)=>sum + (Number(row.active)||0),0))} oportunidades y ${money(matrix.reduce((sum,row)=>sum + (Number(row.activeValue)||0),0))} de pipeline concilia con el resumen regional.`;
        }
      }
    } catch (error) {
      console.error('Error al renderizar Gestión por comercial', error);
      if (!target.children.length) target.innerHTML = '<tr><td colspan="10">No fue posible cargar el detalle comercial. Actualiza la página para reintentar.</td></tr>';
    }
  }

  function renderAds() {
    renderAdsMetrics();
    renderLeadsTrend();
    renderCpl();
    renderAdsInvestment();
    renderAdsPlatform();
    renderCountryLeads();
  }

  function renderAdsMetrics() {
    const leadsRows = adsLeadRows();
    const investmentRows = adsInvestmentRows();
    const leads = sum(leadsRows,'leads');
    const investment = investmentRows.reduce((total,row) => total + totalSpend(row),0);
    const monthlyGoal = Number(DATA.ads.leadGoal) || 25;
    const goal = monthlyGoal * Math.max(leadsRows.length,1);
    const attainment = goal ? leads/goal*100 : 0;
    const monthsHit = leadsRows.filter(row => Number(row.leads) >= monthlyGoal).length;
    const cpl = leads ? investment/leads : 0;
    const best = leadsRows.reduce((best,row) => !best || row.leads > best.leads ? row : best, null);
    const countryScoped = state.country !== 'all';
    const metrics = $('#adsMetrics');
    metrics.dataset.count = '5';
    metrics.innerHTML = [
      metricCard({ label:'Leads generados', value:number(leads), icon:'ri-user-add-line', badge:countryScoped ? `${state.country} · ${adsPeriodLabel()}` : adsPeriodLabel(), foot:countryScoped ? `Aporte del país frente a meta global de ${monthlyGoal}/mes` : `Meta mensual: ${monthlyGoal} leads`, tone:'red' }),
      metricCard({ label:countryScoped ? 'Aporte a meta global' : 'Cumplimiento de meta', value:percent(attainment), icon:'ri-target-line', badge:countryScoped ? `Objetivo global ${monthlyGoal}/mes` : `${monthsHit}/${leadsRows.length} meses en meta`, foot:countryScoped ? 'Comparación contra la meta mensual global de SPIRA' : 'Cumplimiento acumulado de la meta mensual', tone:attainment>=100?'green':'blue', footTone:attainment>=100?'positive':'warning' }),
      metricCard({ label:'Inversión ejecutada', value:money(investment), icon:'ri-advertisement-line', badge:'Notion', foot:`Promedio ${money(investment/Math.max(investmentRows.length,1))} por mes`, tone:'blue' }),
      metricCard({ label:'Costo por lead', value:money(cpl,2), icon:'ri-focus-2-line', badge:'CPL', foot:'Inversión dividida entre leads', tone:'yellow', footTone:'warning' }),
      metricCard({ label:'Mejor mes', value:best ? best.label : '—', icon:'ri-trophy-line', badge:best ? `${best.leads} leads` : 'Sin datos', foot:best ? `${percent(best.leads/monthlyGoal*100)} de la meta mensual` : 'Sin datos', tone:'green', footTone:'positive' })
    ].join('');
  }

  function renderLeadsTrend() {
    const rows = adsLeadRows();
    const monthlyGoal = Number(DATA.ads.leadGoal) || 25;
    const categories = rows.map(row => compactAxisLabel(row, state.adsYear === 'all'));
    const maxValue = Math.max(monthlyGoal, ...rows.map(row => Number(row.leads) || 0));
    const maxY = Math.max(30, Math.ceil((maxValue * 1.22) / 5) * 5);
    const options = baseChart('area', 340);
    Object.assign(options, {
      series:[{ name:'Leads calificados', type:'area', data:rows.map(row => row.leads) }],
      colors:[COLORS.red],
      chart:{...options.chart,type:'area',height:340},
      grid:{...options.grid,padding:{left:8,right:18,top:28,bottom:10}},
      stroke:{curve:'smooth',width:4},
      fill:{type:'gradient',opacity:.28,gradient:{shadeIntensity:1,opacityFrom:.35,opacityTo:.04,stops:[0,95,100]}},
      markers:{size:5,strokeWidth:3,strokeColors:'#fff',hover:{sizeOffset:2}},
      dataLabels:{
        enabled:true,
        formatter:value=>`${number(value)} · ${number(monthlyGoal ? value/monthlyGoal*100 : 0)}%`,
        offsetY:-12,
        style:{fontSize:'9px',fontWeight:850,colors:[COLORS.blue]},
        background:{enabled:true,foreColor:'#fff',borderRadius:5,padding:4,opacity:.94,borderWidth:0}
      },
      annotations:{
        yaxis:[{
          y:monthlyGoal,
          borderColor:COLORS.blue,
          strokeDashArray:6,
          borderWidth:2,
          label:{
            borderColor:COLORS.blue,
            position:'right',
            offsetX:-8,
            style:{background:COLORS.blue,color:'#fff',fontSize:'10px',fontWeight:800,padding:5},
            text:`Meta mensual · ${monthlyGoal} leads`
          }
        }]
      },
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:0,rotateAlways:false,trim:false,hideOverlappingLabels:false,maxHeight:34,style:{fontSize:'10px',fontWeight:700}}},
      yaxis:{min:0,max:maxY,tickAmount:5,labels:{formatter:value=>number(value)}},
      legend:{show:false},
      tooltip:{
        shared:false,
        intersect:false,
        y:{formatter:value=>`${number(value)} leads · ${percent(monthlyGoal ? value/monthlyGoal*100 : 0)} de la meta`}
      }
    });
    mountChart('leadsTrend','#leadsTrendChart',options);
    const support = $('#leadGoalSupport');
    if (support) support.textContent = state.country === 'all'
      ? `Cada punto muestra leads y porcentaje de cumplimiento sobre la meta mensual de ${monthlyGoal}. La línea azul marca el 100%.`
      : `Cada punto muestra el aporte de ${state.country} frente a la meta global mensual de ${monthlyGoal} leads. La línea azul marca el 100% global.`;
  }

  function renderCpl() {
    const leadsRows = adsLeadRows();
    const investmentRows = adsInvestmentRows();
    const invMap = Object.fromEntries(investmentRows.map(row => [row.label || row.month,totalSpend(row)]));
    const values = leadsRows.map(row => row.leads ? (invMap[row.label] || 0)/row.leads : 0);
    const categories = leadsRows.map(row => compactAxisLabel(row, state.adsYear === 'all'));
    const options = baseChart('bar',320);
    Object.assign(options,{
      series:[{name:'CPL',data:values}],
      colors:[COLORS.yellow],
      chart:{...options.chart,type:'bar',height:320},
      grid:{...options.grid,padding:{left:8,right:14,top:18,bottom:10}},
      plotOptions:{bar:{borderRadius:8,columnWidth:'48%',dataLabels:{position:'top'}}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:0,rotateAlways:false,trim:false,hideOverlappingLabels:false,maxHeight:34,style:{fontSize:'10px',fontWeight:700}}},
      yaxis:{labels:{formatter:value=>`$${number(value)}`}},
      dataLabels:{enabled:true,formatter:value=>`$${number(value)}`,offsetY:-18,style:{fontSize:'10px',fontWeight:800,colors:[COLORS.gray]}},
      tooltip:{y:{formatter:value=>money(value,2)}}
    });
    mountChart('cpl','#cplChart',options);
  }

  function renderAdsInvestment() {
    const rows = adsInvestmentRows();
    const categories = rows.map(row => compactAxisLabel(row, state.adsYear === 'all'));
    const options = baseChart('bar',360);
    Object.assign(options,{
      series:[
        {name:'LinkedIn',type:'column',data:rows.map(row=>Number(row.linkedin)||0)},
        {name:'Google',type:'column',data:rows.map(row=>Number(row.google)||0)},
        {name:'Presupuesto',type:'line',data:rows.map(row=>Number(row.budget)||3000)}
      ],
      colors:[COLORS.blue,COLORS.red,COLORS.yellow],
      chart:{...options.chart,type:'line',height:360,stacked:true},
      grid:{...options.grid,padding:{left:8,right:14,top:8,bottom:10}},
      plotOptions:{bar:{borderRadius:5,columnWidth:'48%'}},
      stroke:{width:[0,0,3],curve:'straight',dashArray:[0,0,7]},
      markers:{size:[0,0,4],strokeWidth:2,strokeColors:'#fff'},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:0,rotateAlways:false,trim:false,hideOverlappingLabels:false,maxHeight:34,style:{fontSize:'10px',fontWeight:700}}},
      yaxis:{min:0,labels:{minWidth:34,formatter:value=>`${number(value/1000,1)}K`}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>money(value,2)}}
    });
    mountChart('adsInvestment','#adsInvestmentChart',options);
  }

  function renderAdsPlatform() {
    const rows = adsInvestmentRows();
    const linkedin = sum(rows,'linkedin');
    const google = sum(rows,'google');
    const total = linkedin+google;
    const options = baseChart('donut',250);
    Object.assign(options,{
      series:[linkedin,google],labels:['LinkedIn','Google'],colors:[COLORS.blue,COLORS.red],
      chart:{...options.chart,type:'donut',height:250},
      stroke:{width:4,colors:['#fff']},
      plotOptions:{pie:{donut:{size:'72%',labels:{show:true,total:{show:true,label:'Total',formatter:()=>money(total)},value:{formatter:value=>money(value)}}}}},
      legend:{show:false},tooltip:{y:{formatter:value=>money(value,2)}}
    });
    mountChart('adsPlatform','#adsPlatformChart',options);
    $('#adsPlatformLegend').innerHTML = [
      ['LinkedIn',linkedin,COLORS.blue],['Google',google,COLORS.red]
    ].map(([label,value,color])=>`<div class="legend-line" style="--legend-color:${color}"><i></i><span>${label}</span><strong>${money(value,2)} · ${percent(total?value/total*100:0)}</strong></div>`).join('');
  }

  function renderCountryLeads() {
    const allCountryRows = countryLeadRows(state.adsYear);
    const rows = state.country === 'all' ? allCountryRows : allCountryRows.filter(row=>row.country===state.country);
    const periods = adsPeriods();
    const categories = periods.map(period => compactAxisLabel(period, state.adsYear === 'all'));
    const series = rows.map(row=>({name:row.country,data:periods.map(period=>row[period.key])}));
    const options = baseChart('bar',330);
    Object.assign(options,{
      series,
      colors:rows.map(row=>countryColors[row.country]),
      chart:{...options.chart,type:'bar',height:330,stacked:false},
      plotOptions:{bar:{borderRadius:4,columnWidth:state.country==='all'?'68%':'35%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:0,rotateAlways:false,trim:false,hideOverlappingLabels:false,maxHeight:34,style:{fontSize:'10px',fontWeight:700}}},
      yaxis:{min:0,labels:{formatter:value=>number(value)}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>`${number(value)} leads`}}
    });
    mountChart('countryLeads','#countryLeadsChart',options);

    $('#countryLeadsTableHead').innerHTML = `<tr><th>País</th>${periods.map(period=>`<th>${period.label}</th>`).join('')}<th>Total</th><th>CPL acumulado</th></tr>`;
    $('#countryLeadsTable').innerHTML = rows.map(row=>{
      const totalLeads = periods.reduce((total,period)=>total+(Number(row[period.key])||0),0);
      const investment = DATA.investment.countryHistory
        .filter(item=>item.country===row.country)
        .filter(item=>periods.some(period=>period.year===item.year&&period.monthIndex===item.monthIndex))
        .reduce((total,item)=>total+totalSpend(item),0);
      const cpl = totalLeads ? investment/totalLeads : 0;
      return `<tr><td><strong>${row.country}</strong></td>${periods.map(period=>`<td>${number(row[period.key])}</td>`).join('')}<td><strong>${number(totalLeads)}</strong></td><td>${totalLeads?money(cpl,2):'—'}</td></tr>`;
    }).join('');
    const periodTotals = periods.map(period=>rows.reduce((total,row)=>total+(Number(row[period.key])||0),0));
    const grandLeads = periodTotals.reduce((total,value)=>total+value,0);
    const visibleCountries = new Set(rows.map(row=>row.country));
    const visibleInvestment = DATA.investment.countryHistory
      .filter(item=>visibleCountries.has(item.country))
      .filter(item=>periods.some(period=>period.year===item.year&&period.monthIndex===item.monthIndex))
      .reduce((total,item)=>total+totalSpend(item),0);
    const foot = $('#countryLeadsTableFoot');
    if (foot) foot.innerHTML = rows.length ? `<tr><td>TOTAL</td>${periodTotals.map(value=>`<td>${number(value)}</td>`).join('')}<td>${number(grandLeads)}</td><td>${grandLeads?money(visibleInvestment/grandLeads,2):'—'}</td></tr>` : '';
  }

  function renderInvestment() {
    syncMonthOptions();
    renderInvestmentMetrics();
    renderInvestmentTrend();
    renderInvestmentPlatform();
    renderCountryBudget();
    renderCountryTrend();
    renderBudgetAlerts();
    renderInvestmentTable();
  }

  function renderInvestmentMetrics() {
    const rows = investmentRows();
    const budget = sum(rows,'budget');
    const spent = rows.reduce((total,row)=>total+totalSpend(row),0);
    const remaining = budget-spent;
    const consumption = budget?spent/budget*100:0;
    const leads = sum(rows,'leads');
    $('#investmentMetrics').innerHTML = [
      metricCard({label:'Presupuesto aprobado',value:money(budget),icon:'ri-wallet-3-line',badge:investmentFilterBadge(),foot:`${rows.length} registro${rows.length===1?'':'s'} considerados`,tone:'blue'}),
      metricCard({label:'Inversión ejecutada',value:money(spent,2),icon:'ri-megaphone-line',badge:percent(consumption),foot:'Consumo del presupuesto bajo el filtro activo',tone:'red',footTone:consumption>100?'negative':'positive'}),
      metricCard({label:remaining>=0?'Saldo disponible':'Sobreejecución',value:money(Math.abs(remaining),2),icon:remaining>=0?'ri-safe-2-line':'ri-alarm-warning-line',badge:remaining>=0?'Disponible':'Exceso',foot:remaining>=0?'Presupuesto aún no ejecutado':'Inversión por encima del aprobado',tone:remaining>=0?'green':'yellow',footTone:remaining>=0?'positive':'negative'}),
      metricCard({label:'Costo por lead',value:leads?money(spent/leads,2):'Sin dato',icon:'ri-focus-3-line',badge:`${number(leads)} leads`,foot:'CPL calculado con el mismo filtro activo',tone:'yellow',footTone:'warning'})
    ].join('');
    $('#investmentYearBadge').textContent = `${investmentFilterBadge()} · ${state.country === 'all' ? 'Consolidado' : state.country}`;
  }

  function renderInvestmentTrend() {
    const rows = investmentRows();
    const categories = rows.map(row => state.year === 'all' ? `${row.month} ${row.year}` : row.month);
    const options = baseChart('bar',350);
    Object.assign(options,{
      series:[
        {name:'LinkedIn',type:'column',data:rows.map(row=>row.linkedin)},
        {name:'Google',type:'column',data:rows.map(row=>row.google)},
        {name:'Presupuesto aprobado',type:'line',data:rows.map(row=>row.budget)}
      ],
      colors:[COLORS.blue,COLORS.red,COLORS.yellow],
      chart:{...options.chart,type:'line',height:350,stacked:true,events:{dataPointSelection:(_event,_ctx,config)=>{
        const row = rows[config.dataPointIndex];
        if (!row) return;
        state.month = row.monthIndex;
        syncMonthOptions();
        renderInvestment();
        updateUrl();
        showToast(`Filtro actualizado a ${row.month} ${row.year}.`);
      }}},
      plotOptions:{bar:{borderRadius:5,columnWidth:'48%'}},
      stroke:{width:[0,0,3],dashArray:[0,0,7],curve:'straight'},
      markers:{size:[0,0,4],strokeWidth:2,strokeColors:'#fff'},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false}},
      yaxis:{min:0,labels:{minWidth:34,formatter:value=>`${number(value/1000,1)}K`}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>money(value,2)}}
    });
    mountChart('investmentTrend','#investmentTrendChart',options);
  }

  function renderInvestmentPlatform() {
    const rows = investmentRows();
    const linkedin = sum(rows,'linkedin');
    const google = sum(rows,'google');
    const total = linkedin+google;
    const options = baseChart('donut',255);
    Object.assign(options,{
      series:[linkedin,google],labels:['LinkedIn','Google'],colors:[COLORS.blue,COLORS.red],
      chart:{...options.chart,type:'donut',height:255},
      stroke:{width:4,colors:['#fff']},
      plotOptions:{pie:{donut:{size:'72%',labels:{show:true,total:{show:true,label:'Invertido',formatter:()=>money(total)},value:{formatter:value=>money(value)}}}}},
      legend:{show:false},tooltip:{custom:({series,seriesIndex,w})=>{
        const value = series[seriesIndex] || 0;
        const label = w.globals.labels[seriesIndex] || '';
        const totalValue = (w.globals.seriesTotals || []).reduce((acc,current)=>acc + current,0);
        return `<div class="spira-tooltip-dark"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(money(value,2))}</span><small>${escapeHtml(percent(totalValue ? value/totalValue*100 : 0))} del mix total</small></div>`;
      }}
    });
    mountChart('investmentPlatform','#investmentPlatformChart',options);
    $('#investmentPlatformLegend').innerHTML = [
      ['LinkedIn',linkedin,COLORS.blue],['Google',google,COLORS.red]
    ].map(([label,value,color])=>`<div class="legend-line" style="--legend-color:${color}"><i></i><span>${label}</span><strong>${money(value,2)} · ${percent(total?value/total*100:0)}</strong></div>`).join('');
  }

  function renderCountryBudget() {
    const rows = countryInvestmentRows();
    const monthLabel = state.month === 'all' ? 'Todos los meses' : monthNames[Number(state.month)] || 'Mes';
    const yearLabel = state.year === 'all' ? 'todos los años' : state.year;
    $('#countryBudgetTitle').textContent = `Presupuesto individual y consumo · ${monthLabel} ${yearLabel}`;
    $('#countryMonthFilter').value = String(state.month);
    $('#monthFilter').value = String(state.month);
    const metric = state.countryMetric;
    let series, xTitle, tooltipFormatter, max;
    if (metric === 'spent') {
      series = [
        {name:'Invertido',data:rows.map(row=>totalSpend(row))},
        {name:'Presupuesto',data:rows.map(row=>row.budget)}
      ];
      xTitle = 'USD'; max = undefined; tooltipFormatter = value=>money(value,2);
    } else if (metric === 'consumption') {
      series = [{name:'Consumo',data:rows.map(row=>row.budget?totalSpend(row)/row.budget*100:0)}];
      xTitle = '% consumido'; max = Math.max(120,...(series[0].data.length ? series[0].data : [0]))*1.08; tooltipFormatter = value=>percent(value);
    } else {
      series = [{name:'Saldo',data:rows.map(row=>row.budget-totalSpend(row))}];
      xTitle = 'USD disponibles'; max = undefined; tooltipFormatter = value=>money(value,2);
    }
    const options = baseChart('bar', Math.max(250, rows.length*74));
    Object.assign(options,{
      series,
      colors:metric==='spent'?[COLORS.red,COLORS.blue]:[metric==='consumption'?COLORS.yellow:COLORS.green],
      chart:{...options.chart,type:'bar',height:Math.max(250,rows.length*74)},
      plotOptions:{bar:{horizontal:true,borderRadius:6,barHeight:metric==='spent'?'58%':'42%'}},
      xaxis:{categories:rows.map(row=>row.country),max,labels:{formatter:value=>metric==='consumption'?`${number(value)}%`:`$${number(value)}`},title:{text:xTitle,style:{fontSize:'10px',fontWeight:700,color:COLORS.muted}}},
      yaxis:{labels:{minWidth:76,maxWidth:90,style:{fontWeight:800}}},
      legend:{show:metric==='spent',position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:metric==='spent',intersect:false,y:{formatter:tooltipFormatter}}
    });
    mountChart('countryBudget','#countryBudgetChart',options);

    $('#countryBudgetCards').innerHTML = rows.map(row=>{
      const spent=totalSpend(row), consumption=row.budget?spent/row.budget*100:0, remaining=row.budget-spent, over=remaining<0;
      return `<article class="country-budget-card ${over?'over':''}">
        <div class="country-budget-head"><strong>${row.country}</strong><span class="country-status">${over?'Excedido':'En rango'}</span></div>
        <div class="country-spent">${money(spent,2)}</div><small>de ${money(row.budget,2)} aprobados</small>
        <div class="country-progress" style="--progress:${clamp(consumption,0,100)}%;--progress-color:${over?COLORS.red:(consumption>=90?COLORS.yellow:COLORS.blue)}"><i></i></div>
        <div class="country-card-meta"><span>Consumo <strong>${percent(consumption)}</strong></span><span>${over?'Exceso':'Saldo'} <strong>${money(Math.abs(remaining),2)}</strong></span></div>
      </article>`;
    }).join('') || '<p class="data-footnote">No hay datos por país para este filtro.</p>';
  }

  function renderCountryTrend() {
    const allRows = countryTrendRows();
    const countries = state.country === 'all' ? ['Colombia','México','Perú','CAM'] : [state.country];
    const periods = [...new Map(allRows.map(row => [`${row.year}-${row.monthIndex}`, { year: row.year, monthIndex: row.monthIndex, label: state.year === 'all' ? `${row.month} ${row.year}` : row.month }])).values()]
      .sort((a,b) => (a.year * 12 + a.monthIndex) - (b.year * 12 + b.monthIndex));
    const series = countries.map(country=>({
      name:country,
      data:periods.map(period=>{
        const row=allRows.find(item=>item.country===country&&item.monthIndex===period.monthIndex&&item.year===period.year);
        return row?totalSpend(row):null;
      })
    }));
    const options = baseChart('line',310);
    Object.assign(options,{
      series,
      colors:countries.map(country=>countryColors[country]),
      chart:{...options.chart,type:'line',height:310},
      stroke:{curve:'smooth',width:3},
      markers:{size:4,strokeWidth:2,strokeColors:'#fff'},
      xaxis:{categories:periods.map(period=>period.label),axisBorder:{show:false},axisTicks:{show:false}},
      yaxis:{labels:{formatter:value=>`$${number(value)}`}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>money(value,2)}}
    });
    mountChart('countryTrend','#countryTrendChart',options);
  }

  function renderBudgetAlerts() {
    const rows = countryInvestmentRows();
    const alerts = rows.map(row=>{
      const spent=totalSpend(row), pct=row.budget?spent/row.budget*100:0, remaining=row.budget-spent;
      let type='normal',icon='ri-checkbox-circle-line',title='Ejecución saludable',note=`${percent(pct)} del presupuesto utilizado`;
      if (remaining<0) { type='danger'; icon='ri-error-warning-line'; title='Presupuesto excedido'; note=`Exceso de ${money(Math.abs(remaining),2)}`; }
      else if (pct>=90) { type='warning'; icon='ri-alarm-warning-line'; title='Cerca del límite'; note=`Saldo de ${money(remaining,2)}`; }
      else if (pct<45) { type='warning'; icon='ri-time-line'; title='Baja ejecución'; note=`Saldo de ${money(remaining,2)}`; }
      return {country:row.country,type,icon,title,note,pct};
    }).sort((a,b)=>({danger:0,warning:1,normal:2}[a.type]-{danger:0,warning:1,normal:2}[b.type]));
    $('#budgetAlerts').innerHTML = alerts.map(item=>`<div class="budget-alert ${item.type}"><span class="alert-icon"><i class="${item.icon}"></i></span><div><strong>${item.country} · ${item.title}</strong><small>${item.note}</small></div><span class="alert-value">${percent(item.pct)}</span></div>`).join('') || '<p class="data-footnote">No hay alertas para este filtro.</p>';
  }

  function renderInvestmentTable() {
    const rows = investmentRows();
    $('#investmentTable').innerHTML = rows.map(row=>{
      const spent=totalSpend(row), consumption=row.budget?spent/row.budget*100:0, remaining=row.budget-spent;
      return `<tr><td><strong>${row.month} ${row.year}</strong></td><td>${money(row.budget,2)}</td><td>${money(row.linkedin,2)}</td><td>${money(row.google,2)}</td><td><strong>${money(spent,2)}</strong></td><td>${percent(consumption)}</td><td style="color:${remaining<0?COLORS.red:COLORS.green}">${remaining<0?'−':''}${money(Math.abs(remaining),2)}</td><td>${row.leads==null?'—':number(row.leads)}</td></tr>`;
    }).join('') || '<tr><td colspan="8">No se encontraron resultados.</td></tr>';
    const full = investmentRows();
    const budget=sum(full,'budget'), linkedin=sum(full,'linkedin'), google=sum(full,'google'), spent=linkedin+google, remaining=budget-spent, leads=sum(full,'leads');
    $('#investmentTableFoot').innerHTML = `<tr><td>TOTAL ${investmentFilterBadge()}</td><td>${money(budget,2)}</td><td>${money(linkedin,2)}</td><td>${money(google,2)}</td><td>${money(spent,2)}</td><td>${percent(budget?spent/budget*100:0)}</td><td>${remaining<0?'−':''}${money(Math.abs(remaining),2)}</td><td>${number(leads)}</td></tr>`;
  }


  function digitalFilterRows(rows, ignoreStatus = false) {
    return rows
      .filter(row => state.digitalYear === 'all' || Number(row.year) === Number(state.digitalYear))
      .filter(row => state.digitalMonth === 'all' || Number(row.month) === Number(state.digitalMonth))
      .filter(row => ignoreStatus || state.digitalStatus === 'all' || row.status === state.digitalStatus)
      .sort((a,b) => (Number(a.year) * 12 + Number(a.month)) - (Number(b.year) * 12 + Number(b.month)));
  }

  function digitalChannelVisible(channel) {
    return state.digitalChannel === 'all' || state.digitalChannel === channel;
  }

  function digitalAxisLabel(row) {
    const month = monthShortNames[Number(row.month)] || String(row.period || '').slice(5);
    return state.digitalYear === 'all' ? `${month} ${String(row.year).slice(-2)}` : month;
  }

  function latestDigitalRow(rows, key) {
    return [...rows].reverse().find(row => row[key] != null);
  }

  function weightedDigitalRate(rows, valueKey, weightKey) {
    const valid = rows.filter(row => row[valueKey] != null && Number(row[weightKey]) > 0);
    const weight = sum(valid, weightKey);
    if (weight) return valid.reduce((total,row) => total + Number(row[valueKey]) * Number(row[weightKey]), 0) / weight;
    return latestDigitalRow(rows, valueKey)?.[valueKey] ?? 0;
  }

  function digitalSelectionLabel() {
    const parts = [];
    parts.push(state.digitalYear === 'all' ? 'Todos los años' : String(state.digitalYear));
    parts.push(state.digitalMonth === 'all' ? 'Todos los meses' : monthNames[Number(state.digitalMonth)]);
    if (state.digitalChannel !== 'all') parts.push(state.digitalChannel);
    parts.push(state.digitalStatus === 'all' ? 'Todos los períodos' : state.digitalStatus);
    return parts.join(' · ');
  }

  function averageDigitalMetric(rows, key) {
    const valid = rows.filter(row => row[key] != null && Number.isFinite(Number(row[key])));
    return valid.length ? valid.reduce((total,row) => total + Number(row[key]), 0) / valid.length : null;
  }

  function digitalPhaseRows(rows, phase) {
    return rows.filter(row => row.status === 'Completo' && row.phase === phase);
  }

  function digitalDelta(before, after) {
    if (before == null || after == null || Number(before) === 0) return null;
    return (Number(after) - Number(before)) / Math.abs(Number(before)) * 100;
  }

  function formatDigitalComparison(value, type = 'number', digits = 1) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    if (type === 'percent') return percent(Number(value) * 100, digits);
    if (type === 'hours') return `${number(value,digits)} h`;
    if (type === 'seconds') return `${number(value,digits)} s`;
    return number(value,digits);
  }

  function digitalComparisonCard({ channel, icon, tone, title, metric, before, after, type = 'number', digits = 1, note, secondary = [] }) {
    const delta = digitalDelta(before, after);
    const deltaClass = delta == null ? 'neutral' : delta >= 0 ? 'positive' : 'negative';
    const deltaText = delta == null ? 'Sin base comparable' : `${delta >= 0 ? '+' : ''}${percent(delta,1)}`;
    return `<article class="digital-comparison-card ${tone}">
      <div class="comparison-card-head"><span class="comparison-icon"><i class="${icon}"></i></span><div><strong>${escapeHtml(channel)}</strong><small>${escapeHtml(title)}</small></div><span class="comparison-delta ${deltaClass}">${escapeHtml(deltaText)}</span></div>
      <div class="comparison-primary-label">${escapeHtml(metric)}</div>
      <div class="comparison-values">
        <div><span>Línea base</span><strong>${escapeHtml(formatDigitalComparison(before,type,digits))}</strong><small>promedio mensual</small></div>
        <i class="ri-arrow-right-line"></i>
        <div><span>Gestión</span><strong>${escapeHtml(formatDigitalComparison(after,type,digits))}</strong><small>promedio mensual</small></div>
      </div>
      <div class="comparison-secondary">${secondary.map(item=>`<span><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(formatDigitalComparison(item.before,item.type,item.digits))} → ${escapeHtml(formatDigitalComparison(item.after,item.type,item.digits))}</strong></span>`).join('')}</div>
      <p>${escapeHtml(note)}</p>
    </article>`;
  }

  function renderDigitalComparison() {
    const cards = [];
    if (digitalChannelVisible('Web')) {
      const before = digitalPhaseRows(DIGITAL.web,'Antes del proyecto');
      const after = digitalPhaseRows(DIGITAL.web,'Gestión de la agencia').filter(row=>row.views != null);
      cards.push(digitalComparisonCard({
        channel:'Web', icon:'ri-global-line', tone:'web', title:'Consumo mensual del sitio', metric:'Páginas vistas / vistas GA4',
        before:averageDigitalMetric(before,'historicalPageViews'), after:averageDigitalMetric(after,'views'), digits:0,
        secondary:[
          {label:'Interacción mensual',before:averageDigitalMetric(before,'historicalEngagedSessions'),after:averageDigitalMetric(after,'engagedSessions'),type:'number',digits:0},
          {label:'Tiempo medio',before:averageDigitalMetric(before,'historicalAvgTime'),after:averageDigitalMetric(after,'avgEngagementTime'),type:'seconds',digits:1}
        ],
        note:'Comparabilidad condicional: la línea base y GA4 actual usan definiciones diferentes. Se presenta como referencia evolutiva, sin mezclar usuarios semanales con usuarios mensuales.'
      }));
    }
    if (digitalChannelVisible('YouTube')) {
      const before = digitalPhaseRows(DIGITAL.youtube,'Antes del proyecto');
      const after = digitalPhaseRows(DIGITAL.youtube,'Gestión de la agencia');
      cards.push(digitalComparisonCard({
        channel:'YouTube', icon:'ri-youtube-line', tone:'youtube', title:'Consumo y eficiencia', metric:'Horas de visualización',
        before:averageDigitalMetric(before,'hours'), after:averageDigitalMetric(after,'hours'), type:'hours', digits:1,
        secondary:[
          {label:'CTR de miniatura',before:averageDigitalMetric(before,'ctr'),after:averageDigitalMetric(after,'ctr'),type:'percent',digits:2},
          {label:'Retención media',before:averageDigitalMetric(before,'retention'),after:averageDigitalMetric(after,'retention'),type:'percent',digits:1},
          {label:'Videos/mes',before:averageDigitalMetric(before,'videos'),after:averageDigitalMetric(after,'videos'),type:'number',digits:1}
        ],
        note:'Horas, CTR, retención y producción se comparan sobre meses completos. Las visualizaciones históricas por video se mantienen separadas de las visualizaciones totales actuales.'
      }));
    }
    if (digitalChannelVisible('LinkedIn')) {
      const before = digitalPhaseRows(DIGITAL.linkedin,'Antes del proyecto');
      const after = digitalPhaseRows(DIGITAL.linkedin,'Gestión de la agencia');
      cards.push(digitalComparisonCard({
        channel:'LinkedIn', icon:'ri-linkedin-box-line', tone:'linkedin', title:'Alcance y crecimiento', metric:'Impresiones totales',
        before:averageDigitalMetric(before,'impressionsTotal'), after:averageDigitalMetric(after,'impressionsTotal'), digits:0,
        secondary:[
          {label:'Nuevos seguidores/mes',before:averageDigitalMetric(before,'newFollowers'),after:averageDigitalMetric(after,'newFollowers'),type:'number',digits:1},
          {label:'CTR total',before:averageDigitalMetric(before,'ctrTotal'),after:averageDigitalMetric(after,'ctrTotal'),type:'percent',digits:2},
          {label:'Tasa real',before:averageDigitalMetric(before,'realRateTotal'),after:averageDigitalMetric(after,'realRateTotal'),type:'percent',digits:2}
        ],
        note:'El alcance de gestión incluye meses con pauta. El histórico muestra el total; el detalle mensual mantiene orgánico y patrocinado separados.'
      }));
    }
    const grid = $('#digitalComparisonGrid');
    grid.dataset.count = String(cards.length);
    grid.innerHTML = cards.join('') || '<div class="digital-empty">No hay datos comparables para el canal seleccionado.</div>';
  }

  function digitalManagementAnnotations(rows) {
    const row = rows.find(item => item.period === '2025-08');
    if (!row) return {};
    const label = digitalAxisLabel(row);
    return { xaxis:[{ x:label, borderColor:COLORS.red, strokeDashArray:5, label:{ text:'Inicio gestión', orientation:'horizontal', offsetY:-5, style:{ background:COLORS.red, color:'#fff', fontSize:'9px', fontWeight:700 } } }] };
  }

  function digitalStatusTag(status) {
    const cls = status === 'Completo' ? 'complete' : status === 'Parcial' ? 'partial' : 'missing';
    return `<span class="digital-status-tag ${cls}">${escapeHtml(status || 'Sin datos')}</span>`;
  }

  function renderDigitalHistoryTable() {
    const allRows = {
      Web: digitalFilterRows(DIGITAL.web),
      YouTube: digitalFilterRows(DIGITAL.youtube),
      LinkedIn: digitalFilterRows(DIGITAL.linkedin)
    };
    const channel = state.digitalChannel;
    let headers = [];
    let body = '';
    let footHtml = '';
    const average = values => {
      const clean = values.map(Number).filter(Number.isFinite);
      return clean.length ? clean.reduce((total,value)=>total+value,0)/clean.length : null;
    };
    const weightedAverage = (rows, valueGetter, weightGetter) => {
      let weighted=0, weights=0;
      rows.forEach(row=>{
        const value=Number(valueGetter(row));
        const weight=Number(weightGetter(row));
        if (Number.isFinite(value) && Number.isFinite(weight) && weight>0) { weighted += value*weight; weights += weight; }
      });
      return weights ? weighted/weights : null;
    };
    if (channel === 'Web') {
      const rows=allRows.Web;
      headers = ['Período','Fase','Estado','Consumo de páginas','Sesiones','Sesiones con interacción','Interacción','Rebote'];
      body = rows.map(row=>`<tr><td><strong>${escapeHtml(row.period)}</strong></td><td>${escapeHtml(row.phase)}</td><td>${digitalStatusTag(row.status)}</td><td>${number(row.views ?? row.historicalPageViews ?? 0)}</td><td>${row.sessions==null?'—':number(row.sessions)}</td><td>${number(row.engagedSessions ?? row.historicalEngagedSessions ?? 0)}</td><td>${row.interactionRate==null?'—':percent(Number(row.interactionRate)*100)}</td><td>${row.bounceRate==null?'—':percent(Number(row.bounceRate)*100)}</td></tr>`).join('');
      const views=rows.reduce((t,row)=>t+Number(row.views ?? row.historicalPageViews ?? 0),0);
      const sessions=rows.reduce((t,row)=>t+(row.sessions==null?0:Number(row.sessions)||0),0);
      const engaged=rows.reduce((t,row)=>t+Number(row.engagedSessions ?? row.historicalEngagedSessions ?? 0),0);
      const gaRows=rows.filter(row=>row.sessions!=null && row.engagedSessions!=null);
      const gaSessions=gaRows.reduce((t,row)=>t+(Number(row.sessions)||0),0);
      const gaEngaged=gaRows.reduce((t,row)=>t+(Number(row.engagedSessions)||0),0);
      const interaction=gaSessions?gaEngaged/gaSessions:null;
      const bounce=weightedAverage(gaRows,row=>row.bounceRate,row=>row.sessions);
      footHtml = rows.length ? `<tr><td>TOTAL / RESUMEN</td><td>—</td><td>—</td><td>${number(views)}</td><td>${number(sessions)}</td><td>${number(engaged)}</td><td>${interaction==null?'—':percent(interaction*100)}</td><td>${bounce==null?'—':percent(bounce*100)}</td></tr>` : '';
    } else if (channel === 'YouTube') {
      const rows=allRows.YouTube;
      headers = ['Período','Fase','Estado','Videos','Vistas / prom. por video','Horas','CTR','Retención'];
      body = rows.map(row=>`<tr><td><strong>${escapeHtml(row.period)}</strong></td><td>${escapeHtml(row.phase)}</td><td>${digitalStatusTag(row.status)}</td><td>${number(row.videos)}</td><td>${row.views!=null?number(row.views):row.historicalAvgViewsPerVideo!=null?`${number(row.historicalAvgViewsPerVideo,1)} prom.`:'—'}</td><td>${number(row.hours,1)}</td><td>${row.ctr==null?'—':percent(Number(row.ctr)*100,2)}</td><td>${row.retention==null?'—':percent(Number(row.retention)*100,1)}</td></tr>`).join('');
      const videos=rows.reduce((t,row)=>t+(Number(row.videos)||0),0);
      const knownViewRows=rows.filter(row=>row.views!=null);
      const views=knownViewRows.reduce((t,row)=>t+(Number(row.views)||0),0);
      const hours=rows.reduce((t,row)=>t+(Number(row.hours)||0),0);
      const ctr=weightedAverage(knownViewRows,row=>row.ctr,row=>row.views) ?? average(rows.filter(row=>row.ctr!=null).map(row=>row.ctr));
      const retention=weightedAverage(knownViewRows,row=>row.retention,row=>row.views) ?? average(rows.filter(row=>row.retention!=null).map(row=>row.retention));
      footHtml = rows.length ? `<tr><td>TOTAL / RESUMEN</td><td>—</td><td>—</td><td>${number(videos)}</td><td>${knownViewRows.length?number(views):'—'}</td><td>${number(hours,1)}</td><td>${ctr==null?'—':`Prom. ${percent(ctr*100,2)}`}</td><td>${retention==null?'—':`Prom. ${percent(retention*100,1)}`}</td></tr>` : '';
    } else if (channel === 'LinkedIn') {
      const rows=allRows.LinkedIn;
      headers = ['Período','Fase','Estado','Impresiones','Orgánico','Patrocinado','Seguidores','CTR','Tasa real'];
      body = rows.map(row=>`<tr><td><strong>${escapeHtml(row.period)}</strong></td><td>${escapeHtml(row.phase)}</td><td>${digitalStatusTag(row.status)}</td><td>${number(row.impressionsTotal)}</td><td>${row.impressionsOrganic==null?'—':number(row.impressionsOrganic)}</td><td>${row.impressionsSponsored==null?'—':number(row.impressionsSponsored)}</td><td>${number(row.newFollowers)}</td><td>${row.ctrTotal==null?'—':percent(Number(row.ctrTotal)*100,2)}</td><td>${row.realRateTotal==null?'—':percent(Number(row.realRateTotal)*100,2)}</td></tr>`).join('');
      const impressions=rows.reduce((t,row)=>t+(Number(row.impressionsTotal)||0),0);
      const organic=rows.reduce((t,row)=>t+(Number(row.impressionsOrganic)||0),0);
      const sponsored=rows.reduce((t,row)=>t+(Number(row.impressionsSponsored)||0),0);
      const followers=rows.reduce((t,row)=>t+(Number(row.newFollowers)||0),0);
      const ctr=weightedAverage(rows,row=>row.ctrTotal,row=>row.impressionsTotal);
      const realRate=weightedAverage(rows,row=>row.realRateTotal,row=>row.impressionsTotal);
      footHtml = rows.length ? `<tr><td>TOTAL / RESUMEN</td><td>—</td><td>—</td><td>${number(impressions)}</td><td>${number(organic)}</td><td>${number(sponsored)}</td><td>${number(followers)}</td><td>${ctr==null?'—':`Prom. ${percent(ctr*100,2)}`}</td><td>${realRate==null?'—':`Prom. ${percent(realRate*100,2)}`}</td></tr>` : '';
    } else {
      headers = ['Período','Fase','Web · consumo','YouTube · horas','YouTube · vistas','LinkedIn · impresiones','LinkedIn · seguidores','Cobertura'];
      const periods = [...new Set([...allRows.Web,...allRows.YouTube,...allRows.LinkedIn].map(row=>row.period))].sort();
      body = periods.map(period=>{
        const web=allRows.Web.find(row=>row.period===period), yt=allRows.YouTube.find(row=>row.period===period), li=allRows.LinkedIn.find(row=>row.period===period);
        const phase = [web,yt,li].find(Boolean)?.phase || (period<'2025-08'?'Antes del proyecto':'Gestión de la agencia');
        const webValue = web ? number(web.views ?? web.historicalPageViews ?? 0) : '—';
        const ytViews = yt ? (yt.views!=null?number(yt.views):yt.historicalAvgViewsPerVideo!=null?`${number(yt.historicalAvgViewsPerVideo,1)} prom.`:'—') : '—';
        const coverage = [web&&`W: ${web.status}`,yt&&`Y: ${yt.status}`,li&&`L: ${li.status}`].filter(Boolean).join(' · ');
        return `<tr><td><strong>${escapeHtml(period)}</strong></td><td>${escapeHtml(phase)}</td><td>${webValue}</td><td>${yt?number(yt.hours,1):'—'}</td><td>${ytViews}</td><td>${li?number(li.impressionsTotal):'—'}</td><td>${li?number(li.newFollowers):'—'}</td><td class="coverage-cell">${escapeHtml(coverage)}</td></tr>`;
      }).join('');
      const webTotal=allRows.Web.reduce((t,row)=>t+Number(row.views ?? row.historicalPageViews ?? 0),0);
      const ytHours=allRows.YouTube.reduce((t,row)=>t+(Number(row.hours)||0),0);
      const ytViews=allRows.YouTube.filter(row=>row.views!=null).reduce((t,row)=>t+(Number(row.views)||0),0);
      const liImpressions=allRows.LinkedIn.reduce((t,row)=>t+(Number(row.impressionsTotal)||0),0);
      const liFollowers=allRows.LinkedIn.reduce((t,row)=>t+(Number(row.newFollowers)||0),0);
      footHtml = periods.length ? `<tr><td>TOTAL / RESUMEN</td><td>—</td><td>${number(webTotal)}</td><td>${number(ytHours,1)}</td><td>${number(ytViews)}</td><td>${number(liImpressions)}</td><td>${number(liFollowers)}</td><td>—</td></tr>` : '';
    }
    $('#digitalHistoryHead').innerHTML = `<tr>${headers.map(header=>`<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
    $('#digitalHistoryTable').innerHTML = body || `<tr><td colspan="${headers.length||1}">No hay registros para el filtro seleccionado.</td></tr>`;
    const foot = $('#digitalHistoryFoot');
    if (foot) foot.innerHTML = footHtml;
    $('#digitalHistoryBadge').textContent = `${digitalSelectionLabel()} · ${body ? (body.match(/<tr>/g)||[]).length : 0} períodos`;
  }

  function renderDigital() {
    $('#digitalChannelFilter').value = state.digitalChannel;
    $('#digitalStatusFilter').value = state.digitalStatus;
    $('#yearFilter').value = String(state.digitalYear);
    $('#monthFilter').value = String(state.digitalMonth);
    $('#digitalPeriodSummary').textContent = digitalSelectionLabel();

    $$('[data-digital-channel]').forEach(panel => {
      panel.hidden = !digitalChannelVisible(panel.dataset.digitalChannel);
    });

    renderDigitalCoverage();
    renderDigitalComparison();
    renderDigitalMetrics();
    if (digitalChannelVisible('Web')) renderDigitalWeb(); else ['webTraffic','webQuality'].forEach(destroyChart);
    if (digitalChannelVisible('YouTube')) renderDigitalYouTube(); else ['youtubeConsumption','youtubeEfficiency','youtubeProduction'].forEach(destroyChart);
    if (digitalChannelVisible('LinkedIn')) renderDigitalLinkedIn(); else ['linkedinReach','linkedinCommunity','linkedinResponse','competitor'].forEach(destroyChart);
    renderDigitalHistoryTable();
    renderDigitalQuality();
  }

  function renderDigitalCoverage() {
    const channels = state.digitalChannel === 'all' ? ['Web','YouTube','LinkedIn'] : [state.digitalChannel];
    const rows = channels.flatMap(channel => digitalFilterRows(DIGITAL[channel.toLowerCase()] || [], true));
    const complete = rows.filter(row => row.status === 'Completo').length;
    const partial = rows.filter(row => row.status === 'Parcial').length;
    const missing = rows.filter(row => row.status === 'Sin datos').length;
    $('#digitalCoverageStrip').innerHTML = [
      `<span class="coverage-chip complete"><i class="ri-checkbox-circle-line"></i>${number(complete)} períodos completos</span>`,
      `<span class="coverage-chip partial"><i class="ri-time-line"></i>${number(partial)} períodos parciales</span>`,
      `<span class="coverage-chip missing"><i class="ri-error-warning-line"></i>${number(missing)} períodos sin datos</span>`,
      `<span class="coverage-chip source"><i class="ri-calendar-check-line"></i>Gestión desde 01/08/2025</span>`
    ].join('');
  }

  function renderDigitalMetrics() {
    const webRows = digitalFilterRows(DIGITAL.web);
    const youtubeRows = digitalFilterRows(DIGITAL.youtube);
    const linkedinRows = digitalFilterRows(DIGITAL.linkedin);
    const cards = [];

    if (digitalChannelVisible('Web')) {
      const ga4 = webRows.filter(row => row.sessions != null);
      const historical = webRows.filter(row => row.historicalPageViews != null);
      if (state.digitalChannel === 'Web') {
        if (ga4.length) {
          const sessions = sum(ga4,'sessions');
          const engaged = sum(ga4,'engagedSessions');
          const views = sum(ga4,'views');
          cards.push(metricCard({label:'Sesiones web',value:number(sessions),icon:'ri-global-line',badge:'GA4',foot:`${number(ga4.length)} períodos con datos`,tone:'green'}));
          const latestGa4 = latestDigitalRow(ga4,'activeUsers');
          cards.push(metricCard({label:'Vistas web',value:number(views),icon:'ri-pages-line',badge:'GA4',foot:latestGa4?`${number(latestGa4.activeUsers)} usuarios activos en ${latestGa4.period}`:'Sin usuarios activos',tone:'blue'}));
          cards.push(metricCard({label:'Sesiones con interacción',value:number(engaged),icon:'ri-pulse-line',badge:'Calidad',foot:'Sesiones con interacción acumuladas',tone:'yellow'}));
          cards.push(metricCard({label:'Tasa de interacción',value:percent(sessions?engaged/sessions*100:0),icon:'ri-percent-line',badge:'Ponderada',foot:'Sesiones con interacción ÷ sesiones',tone:'red'}));
        } else {
          const latest = latestDigitalRow(historical,'activeUsersWeekly');
          cards.push(metricCard({label:'Páginas vistas',value:number(sum(historical,'historicalPageViews')),icon:'ri-pages-line',badge:'Histórico',foot:'Línea base previa a GA4 actual',tone:'green'}));
          cards.push(metricCard({label:'Sesiones con interacción',value:number(sum(historical,'historicalEngagedSessions')),icon:'ri-pulse-line',badge:'Histórico',foot:'Definición histórica reportada',tone:'blue'}));
          cards.push(metricCard({label:'Usuarios activos',value:latest?number(latest.activeUsersWeekly,1):'—',icon:'ri-user-line',badge:'Promedio semanal',foot:latest?latest.period:'Sin dato',tone:'yellow'}));
          cards.push(metricCard({label:'Tiempo medio',value:latest?`${number(latest.historicalAvgTime)} s`:'—',icon:'ri-timer-line',badge:'Histórico',foot:'Último período con dato',tone:'red'}));
        }
      } else {
        if (ga4.length) {
          cards.push(metricCard({label:'Web · Sesiones',value:number(sum(ga4,'sessions')),icon:'ri-global-line',badge:'GA4',foot:`${number(ga4.length)} períodos comparables`,tone:'green'}));
          cards.push(metricCard({label:'Web · Vistas',value:number(sum(ga4,'views')),icon:'ri-pages-line',badge:'GA4',foot:'No incluye páginas vistas históricas',tone:'blue'}));
        } else {
          cards.push(metricCard({label:'Web · Páginas vistas',value:number(sum(historical,'historicalPageViews')),icon:'ri-pages-line',badge:'Histórico',foot:'Línea base previa a GA4 actual',tone:'green'}));
          cards.push(metricCard({label:'Web · Interacción',value:number(sum(historical,'historicalEngagedSessions')),icon:'ri-pulse-line',badge:'Histórico',foot:'Sesiones con interacción reportadas',tone:'blue'}));
        }
      }
    }

    if (digitalChannelVisible('YouTube')) {
      const current = youtubeRows.filter(row => row.views != null);
      const views = sum(current,'views');
      const hours = sum(youtubeRows,'hours');
      const ctr = weightedDigitalRate(current,'ctr','impressions');
      const retention = weightedDigitalRate(current,'retention','views');
      if (state.digitalChannel === 'YouTube') {
        if (current.length) {
          cards.push(metricCard({label:'Visualizaciones',value:number(views),icon:'ri-youtube-line',badge:'Canal',foot:'Desde agosto de 2025 en Analytics',tone:'red'}));
          cards.push(metricCard({label:'Horas de visualización',value:number(hours,1),icon:'ri-time-line',badge:'Consumo',foot:'Suma de períodos visibles',tone:'blue'}));
          cards.push(metricCard({label:'CTR de miniatura',value:percent(ctr*100,2),icon:'ri-cursor-line',badge:'Ponderado',foot:'Ponderado por impresiones disponibles',tone:'yellow'}));
          cards.push(metricCard({label:'Retención media',value:percent(retention*100,1),icon:'ri-bar-chart-box-line',badge:'Ponderada',foot:'Ponderada por visualizaciones',tone:'green'}));
        } else {
          const latest = latestDigitalRow(youtubeRows,'historicalAvgViewsPerVideo');
          cards.push(metricCard({label:'Promedio de vistas por video',value:latest?number(latest.historicalAvgViewsPerVideo,1):'—',icon:'ri-youtube-line',badge:'Histórico',foot:latest?latest.period:'Sin dato',tone:'red'}));
          cards.push(metricCard({label:'Horas de visualización',value:number(hours,1),icon:'ri-time-line',badge:'Histórico',foot:'Suma de períodos visibles',tone:'blue'}));
          cards.push(metricCard({label:'CTR de miniatura',value:latest?percent(Number(latest.ctr)*100,2):'—',icon:'ri-cursor-line',badge:'Último período',foot:'Sin impresiones para ponderar',tone:'yellow'}));
          cards.push(metricCard({label:'Retención media',value:latest?percent(Number(latest.retention)*100,1):'—',icon:'ri-bar-chart-box-line',badge:'Último período',foot:'Línea base histórica',tone:'green'}));
        }
      } else {
        if (current.length) {
          cards.push(metricCard({label:'YouTube · Vistas',value:number(views),icon:'ri-youtube-line',badge:'Canal',foot:`${number(current.length)} períodos Analytics`,tone:'red'}));
          cards.push(metricCard({label:'YouTube · Horas',value:number(hours,1),icon:'ri-time-line',badge:'Visualización',foot:'Tiempo total reportado',tone:'yellow'}));
        } else {
          cards.push(metricCard({label:'YouTube · Videos',value:number(sum(youtubeRows,'videos')),icon:'ri-youtube-line',badge:'Histórico',foot:'Publicaciones del período visible',tone:'red'}));
          cards.push(metricCard({label:'YouTube · Horas',value:number(hours,1),icon:'ri-time-line',badge:'Histórico',foot:'Tiempo total reportado',tone:'yellow'}));
        }
      }
    }

    if (digitalChannelVisible('LinkedIn')) {
      const impressions = sum(linkedinRows,'impressionsTotal');
      const interactions = sum(linkedinRows,'realInteractionsTotal');
      const followers = sum(linkedinRows,'newFollowers');
      const realRate = impressions ? interactions / impressions : 0;
      if (state.digitalChannel === 'LinkedIn') {
        cards.push(metricCard({label:'Impresiones',value:number(impressions),icon:'ri-linkedin-box-line',badge:'Total',foot:'Orgánico + patrocinado cuando aplica',tone:'blue'}));
        cards.push(metricCard({label:'Interacciones reales',value:number(interactions),icon:'ri-chat-smile-2-line',badge:'Respuesta',foot:'Reacciones + comentarios + compartidos',tone:'green'}));
        cards.push(metricCard({label:'Nuevos seguidores',value:number(followers),icon:'ri-user-add-line',badge:'Comunidad',foot:'Crecimiento acumulado visible',tone:'red'}));
        cards.push(metricCard({label:'Tasa real',value:percent(realRate*100,2),icon:'ri-percent-line',badge:'Recalculada',foot:'Interacciones reales ÷ impresiones',tone:'yellow'}));
      } else {
        cards.push(metricCard({label:'LinkedIn · Impresiones',value:number(impressions),icon:'ri-linkedin-box-line',badge:'Total',foot:'No se suma con otros canales',tone:'blue'}));
        cards.push(metricCard({label:'LinkedIn · Seguidores',value:number(followers),icon:'ri-user-add-line',badge:'Nuevos',foot:'Crecimiento del período visible',tone:'green'}));
      }
    }

    const container = $('#digitalMetrics');
    container.dataset.count = String(cards.length);
    container.innerHTML = cards.join('') || '<div class="digital-empty">No hay métricas disponibles para la combinación de filtros seleccionada.</div>';
  }

  function renderDigitalWeb() {
    const rows = digitalFilterRows(DIGITAL.web);
    const categories = rows.map(digitalAxisLabel);
    const hasGa4 = rows.some(row => row.sessions != null);
    const options = baseChart('line',350);
    const hasHistorical = rows.some(row => row.historicalPageViews != null);
    const series = hasGa4 ? [
      ...(hasHistorical ? [{name:'Páginas vistas históricas',type:'column',data:rows.map(row=>row.historicalPageViews)}] : []),
      {name:'Sesiones GA4',type:'column',data:rows.map(row=>row.sessions)},
      {name:'Sesiones con interacción GA4',type:'column',data:rows.map(row=>row.engagedSessions)},
      {name:'Vistas GA4',type:'line',data:rows.map(row=>row.views)}
    ] : [
      {name:'Páginas vistas históricas',type:'column',data:rows.map(row=>row.historicalPageViews)},
      {name:'Sesiones con interacción (hist.)',type:'line',data:rows.map(row=>row.historicalEngagedSessions)}
    ];
    Object.assign(options,{
      series,
      colors:hasGa4?(hasHistorical?[COLORS.gray,COLORS.blue,COLORS.green,COLORS.red]:[COLORS.blue,COLORS.green,COLORS.red]):[COLORS.blue,COLORS.yellow],
      chart:{...options.chart,type:'line',height:350,stacked:false},
      stroke:{width:hasGa4?(hasHistorical?[0,0,0,3]:[0,0,3]):[0,3],curve:'smooth'},
      plotOptions:{bar:{borderRadius:5,columnWidth:'52%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false,hideOverlappingLabels:false}},
      yaxis:{min:0,labels:{formatter:value=>number(value)}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'11px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>number(value)}},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('webTraffic','#webTrafficChart',options);

    const ga4 = rows.filter(row=>row.interactionRate != null);
    const qualityOptions = baseChart('line',300);
    if (ga4.length) {
      Object.assign(qualityOptions,{
        series:[
          {name:'Interacción',data:ga4.map(row=>Number(row.interactionRate)*100)},
          {name:'Rebote',data:ga4.map(row=>Number(row.bounceRate)*100)}
        ],
        colors:[COLORS.green,COLORS.red],
        chart:{...qualityOptions.chart,type:'line',height:300},
        stroke:{curve:'smooth',width:3},markers:{size:4,strokeColors:'#fff',strokeWidth:2},
        xaxis:{categories:ga4.map(digitalAxisLabel),axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false}},
        yaxis:{min:0,max:100,labels:{formatter:value=>`${number(value)}%`}},
        legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},
        tooltip:{shared:true,intersect:false,y:{formatter:value=>percent(value)}}
      });
    } else {
      const historical = rows.filter(row=>row.historicalAvgTime != null);
      Object.assign(qualityOptions,{
        series:[{name:'Tiempo medio reportado',data:historical.map(row=>row.historicalAvgTime)}],
        colors:[COLORS.yellow],chart:{...qualityOptions.chart,type:'line',height:300},
        stroke:{curve:'smooth',width:3},markers:{size:5},
        xaxis:{categories:historical.map(digitalAxisLabel),axisBorder:{show:false},axisTicks:{show:false}},
        yaxis:{min:0,labels:{formatter:value=>`${number(value)} s`}},
        legend:{show:false},tooltip:{y:{formatter:value=>`${number(value)} segundos`}}
      });
    }
    mountChart('webQuality','#webQualityChart',qualityOptions);
    const best = ga4.reduce((best,row)=>!best||Number(row.interactionRate)>Number(best.interactionRate)?row:best,null);
    $('#webInsight').innerHTML = best
      ? `Mejor tasa de interacción visible: <strong>${percent(Number(best.interactionRate)*100)}</strong> en <strong>${escapeHtml(best.period)}</strong>. La brecha de agosto–octubre de 2025 se conserva sin interpolación.`
      : 'La línea histórica usa definiciones distintas a GA4. Los usuarios activos históricos corresponden a un promedio semanal.';
    $('#webPeriodBadge').textContent = hasGa4 ? 'GA4 mensual' : 'Línea histórica';
  }

  function renderDigitalYouTube() {
    const rows = digitalFilterRows(DIGITAL.youtube);
    const categories = rows.map(digitalAxisLabel);

    const evolution = baseChart('line',350);
    Object.assign(evolution,{
      series:[
        {name:'Videos publicados',type:'column',data:rows.map(row=>row.videos)},
        {name:'Horas de visualización',type:'area',data:rows.map(row=>row.hours)}
      ],
      colors:[COLORS.red,COLORS.blue],
      chart:{...evolution.chart,type:'line',height:350},
      stroke:{width:[0,3],curve:'smooth'},
      fill:{type:['solid','gradient'],opacity:[.9,.22],gradient:{opacityFrom:.35,opacityTo:.04,stops:[0,95,100]}},
      plotOptions:{bar:{borderRadius:5,columnWidth:'48%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false,hideOverlappingLabels:false}},
      yaxis:[
        {seriesName:'Videos publicados',min:0,forceNiceScale:true,labels:{formatter:value=>number(value)},title:{text:'Videos'}},
        {seriesName:'Horas de visualización',opposite:true,min:0,labels:{formatter:value=>`${number(value)} h`},title:{text:'Horas'}}
      ],
      legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},
      tooltip:{shared:true,intersect:false,y:{formatter:(value,{seriesIndex})=>seriesIndex===0?`${number(value)} videos`:`${number(value,1)} horas`}},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('youtubeConsumption','#youtubeConsumptionChart',evolution);

    const efficiency = baseChart('line',300);
    Object.assign(efficiency,{
      series:[
        {name:'CTR miniatura',data:rows.map(row=>row.ctr==null?null:Number(row.ctr)*100)},
        {name:'Retención',data:rows.map(row=>row.retention==null?null:Number(row.retention)*100)}
      ],colors:[COLORS.yellow,COLORS.blue],chart:{...efficiency.chart,type:'line',height:300},
      stroke:{curve:'smooth',width:3},markers:{size:4,strokeColors:'#fff',strokeWidth:2},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false}},
      yaxis:{min:0,labels:{formatter:value=>`${number(value)}%`}},
      annotations:{
        ...digitalManagementAnnotations(rows),
        yaxis:[{y:4,borderColor:COLORS.yellow,strokeDashArray:4,label:{text:'CTR 4%',style:{fontSize:'9px'}}},{y:40,borderColor:COLORS.blue,strokeDashArray:4,label:{text:'Retención 40%',style:{fontSize:'9px'}}}]
      },
      legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},tooltip:{shared:true,intersect:false,y:{formatter:value=>percent(value,2)}}
    });
    mountChart('youtubeEfficiency','#youtubeEfficiencyChart',efficiency);

    const performance = baseChart('line',310);
    Object.assign(performance,{
      series:[
        {name:'Promedio histórico por video',type:'line',data:rows.map(row=>row.historicalAvgViewsPerVideo)},
        {name:'Visualizaciones actuales',type:'column',data:rows.map(row=>row.views)},
        {name:'Visualizaciones interesadas',type:'column',data:rows.map(row=>row.interestedViews)}
      ],
      colors:[COLORS.gray,COLORS.red,COLORS.blue],
      chart:{...performance.chart,type:'line',height:310},
      stroke:{width:[3,0,0],dashArray:[6,0,0],curve:'smooth'},
      markers:{size:[4,0,0],strokeColors:'#fff',strokeWidth:2},
      plotOptions:{bar:{borderRadius:5,columnWidth:'54%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false}},
      yaxis:{min:0,labels:{formatter:value=>number(value)}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>`${number(value,1)} visualizaciones`}},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('youtubeProduction','#youtubeProductionChart',performance);

    const bestCtr = rows.reduce((best,row)=>row.ctr!=null&&(!best||Number(row.ctr)>Number(best.ctr))?row:best,null);
    const bestRetention = rows.reduce((best,row)=>row.retention!=null&&(!best||Number(row.retention)>Number(best.retention))?row:best,null);
    $('#youtubeInsight').innerHTML = `Mejor CTR visible: <strong>${bestCtr?percent(Number(bestCtr.ctr)*100,2):'—'}</strong>${bestCtr?` en ${escapeHtml(bestCtr.period)}`:''}. Mejor retención: <strong>${bestRetention?percent(Number(bestRetention.retention)*100,1):'—'}</strong>${bestRetention?` en ${escapeHtml(bestRetention.period)}`:''}.`;
    $('#youtubePeriodBadge').textContent = 'Serie histórica completa';
  }

  function renderDigitalLinkedIn() {
    const rows = digitalFilterRows(DIGITAL.linkedin);
    const categories = rows.map(digitalAxisLabel);
    const historicalTotal = rows.map(row=>row.impressionsOrganic==null?row.impressionsTotal:0);
    const organic = rows.map(row=>row.impressionsOrganic==null?0:row.impressionsOrganic);
    const sponsored = rows.map(row=>row.impressionsSponsored==null?0:row.impressionsSponsored);
    const reach = baseChart('bar',350);
    Object.assign(reach,{
      series:[
        {name:'Total histórico',data:historicalTotal},
        {name:'Orgánico',data:organic},
        {name:'Patrocinado',data:sponsored}
      ],colors:[COLORS.gray,COLORS.blue,COLORS.red],chart:{...reach.chart,type:'bar',height:350,stacked:true},
      plotOptions:{bar:{borderRadius:4,columnWidth:'58%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false,hideOverlappingLabels:false}},
      yaxis:{min:0,labels:{formatter:value=>value>=1000?`${number(value/1000,1)}K`:number(value)}},
      legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},tooltip:{shared:true,intersect:false,y:{formatter:value=>number(value)}},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('linkedinReach','#linkedinReachChart',reach);

    const community = baseChart('line',300);
    Object.assign(community,{
      series:[
        {name:'Nuevos seguidores',type:'column',data:rows.map(row=>row.newFollowers)},
        {name:'Visitantes únicos/día',type:'line',data:rows.map(row=>row.uniqueVisitorsPerDay)}
      ],colors:[COLORS.blue,COLORS.yellow],chart:{...community.chart,type:'line',height:300},
      stroke:{width:[0,3],curve:'smooth'},plotOptions:{bar:{borderRadius:5,columnWidth:'48%'}},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false}},
      yaxis:{min:0,labels:{formatter:value=>number(value)}},legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},tooltip:{shared:true,intersect:false},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('linkedinCommunity','#linkedinCommunityChart',community);

    const response = baseChart('line',310);
    Object.assign(response,{
      series:[
        {name:'CTR total',data:rows.map(row=>row.ctrTotal==null?null:Number(row.ctrTotal)*100)},
        {name:'Tasa real',data:rows.map(row=>row.realRateTotal==null?null:Number(row.realRateTotal)*100)}
      ],colors:[COLORS.yellow,COLORS.green],chart:{...response.chart,type:'line',height:310},
      stroke:{curve:'smooth',width:3},markers:{size:4,strokeColors:'#fff',strokeWidth:2},
      xaxis:{categories,axisBorder:{show:false},axisTicks:{show:false},labels:{rotate:-35,trim:false}},
      yaxis:{min:0,labels:{formatter:value=>`${number(value)}%`}},legend:{position:'top',horizontalAlign:'right',fontSize:'10px'},
      tooltip:{shared:true,intersect:false,y:{formatter:value=>percent(value,2)}},
      annotations:digitalManagementAnnotations(rows)
    });
    mountChart('linkedinResponse','#linkedinResponseChart',response);

    const competitors = [...DIGITAL.competitors].sort((a,b)=>Number(b.newFollowers)-Number(a.newFollowers));
    const competitorOptions = baseChart('bar',Math.max(300,competitors.length*42));
    Object.assign(competitorOptions,{
      series:[{name:'Nuevos seguidores',data:competitors.map(row=>row.newFollowers)}],
      colors:competitors.map(row=>row.page==='SPIRA'?COLORS.red:'#B7BCE0'),
      chart:{...competitorOptions.chart,type:'bar',height:Math.max(300,competitors.length*42)},
      plotOptions:{bar:{horizontal:true,distributed:true,borderRadius:5,barHeight:'58%',dataLabels:{position:'top'}}},
      xaxis:{categories:competitors.map(row=>row.page),labels:{formatter:value=>number(value)}},
      yaxis:{labels:{style:{fontSize:'10px',fontWeight:700}}},
      dataLabels:{enabled:true,formatter:value=>number(value),style:{fontSize:'9px',colors:[COLORS.gray]},offsetX:8},legend:{show:false},tooltip:{y:{formatter:value=>`${number(value)} seguidores`}}
    });
    mountChart('competitor','#competitorChart',competitorOptions);

    const bestReach = rows.reduce((best,row)=>!best||Number(row.impressionsTotal)>Number(best.impressionsTotal)?row:best,null);
    const bestFollowers = rows.reduce((best,row)=>!best||Number(row.newFollowers)>Number(best.newFollowers)?row:best,null);
    $('#linkedinInsight').innerHTML = `Mayor alcance visible: <strong>${bestReach?number(bestReach.impressionsTotal):'—'}</strong>${bestReach?` en ${escapeHtml(bestReach.period)}`:''}. Mayor crecimiento: <strong>${bestFollowers?`+${number(bestFollowers.newFollowers)}`:'—'}</strong>${bestFollowers?` en ${escapeHtml(bestFollowers.period)}`:''}.`;
    $('#linkedinPeriodBadge').textContent = rows.some(row=>Number(row.impressionsSponsored)>0) ? 'Orgánico + pauta' : 'Orgánico / total';
  }

  function renderDigitalQuality() {
    const allowed = state.digitalChannel === 'all'
      ? ['General','Web','YouTube','LinkedIn','Spira Talks']
      : ['General',state.digitalChannel, ...(state.digitalChannel==='YouTube'?['Spira Talks']:[])];
    const priorityTopics = ['No mezclar plataformas','Brecha mensual','Usuarios activos no comparables','Eventos clave','Visualizaciones distintas','Fechas de publicación faltantes','Orgánico y patrocinado','CTR no equivale a tráfico web','Ajuste negativo','Competidores'];
    let rows = DIGITAL.quality.filter(row=>allowed.includes(row.channel));
    const topicRank = topic => { const index = priorityTopics.indexOf(topic); return index < 0 ? 999 : index; };
    rows.sort((a,b)=>topicRank(a.topic)-topicRank(b.topic));
    rows = rows.slice(0,state.digitalChannel==='all'?9:6);
    $('#digitalQualityGrid').innerHTML = rows.map(row=>`<article class="quality-card"><div class="quality-card-head"><strong>${escapeHtml(row.topic)}</strong><span>${escapeHtml(row.channel)}</span></div><p>${escapeHtml(row.finding)}</p><small>${escapeHtml(row.treatment)}</small></article>`).join('');
  }

  function exportDigitalCsv() {
    const channels = state.digitalChannel === 'all' ? ['Web','YouTube','LinkedIn'] : [state.digitalChannel];
    const rows = [];
    channels.forEach(channel=>{
      const source = digitalFilterRows(DIGITAL[channel.toLowerCase()] || []);
      source.forEach(row=>{
        if (channel === 'Web') rows.push([channel,row.period,row.phase,row.status,row.sessions??'',row.engagedSessions??row.historicalEngagedSessions??'',row.views??row.historicalPageViews??'',row.interactionRate??'',row.bounceRate??'',row.source]);
        if (channel === 'YouTube') rows.push([channel,row.period,row.phase,row.status,row.views??row.historicalAvgViewsPerVideo??'',row.interestedViews??'',row.hours??'',row.ctr??'',row.retention??'',row.source]);
        if (channel === 'LinkedIn') rows.push([channel,row.period,row.phase,row.status,row.impressionsTotal??'',row.realInteractionsTotal??'',row.newFollowers??'',row.ctrTotal??'',row.realRateTotal??'',row.source]);
      });
    });
    downloadCsv('spira-canales-digitales.csv',['Canal','Periodo','Fase','Estado','Métrica 1','Métrica 2','Métrica 3','Tasa 1','Tasa 2','Fuente'],rows);
  }

  function setCountryMode(mode) {

    state.countryMode = mode;
    $$('[data-country-mode]').forEach(button=>button.classList.toggle('active',button.dataset.countryMode===mode));
    $('#countryLeadsChart').hidden = mode !== 'chart';
    $('#countryLeadsTableWrap').hidden = mode !== 'table';
  }

  function downloadCsv(filename, headers, rows) {
    const lines = [headers,...rows].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(';'));
    const blob = new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
    showToast(`Archivo ${filename} generado.`);
  }

  function exportCurrentView() {
    if (state.view === 'overview') {
      const salesMap=Object.fromEntries(filteredSales().map(row=>[row.country,row]));
      const commercialLabel=state.commercial==='all'?'Todos':state.commercial;
      const rows=filteredPipeline().map(row=>[commercialLabel,state.overviewMonth==='all'?'Todos':monthNames[Number(state.overviewMonth)],row.country,row.generated,row.value,row.lost,row.proposals,row.avgTicket,salesMap[row.country]?.closes||0,salesMap[row.country]?.value||0]);
      downloadCsv('spira-resumen-comercial.csv',['Comercial','Mes','País','Pipeline generado USD','Pipeline activo USD','Pipeline perdido USD','Propuestas activas','Ticket promedio USD','Cierres','Ventas USD'],rows);
    } else if (state.view === 'ads') {
      const periods=adsPeriods();
      const allCountryRows=countryLeadRows(state.adsYear);
      const sourceRows=state.country==='all'?allCountryRows:allCountryRows.filter(row=>row.country===state.country);
      const rows=sourceRows.map(row=>{
        const totalLeads=periods.reduce((total,period)=>total+(Number(row[period.key])||0),0);
        const investment=DATA.investment.countryHistory
          .filter(item=>item.country===row.country)
          .filter(item=>periods.some(period=>period.year===item.year&&period.monthIndex===item.monthIndex))
          .reduce((total,item)=>total+totalSpend(item),0);
        return [row.country,...periods.map(period=>row[period.key]),totalLeads,totalLeads?investment/totalLeads:''];
      });
      downloadCsv(`spira-performance-ads-${state.adsYear}-${state.adsMonth}.csv`,['País',...periods.map(period=>period.label),'Total leads','CPL acumulado USD'],rows);
    } else if (state.view === 'digital') {
      exportDigitalCsv();
    } else exportInvestmentCsv();
  }

  function exportInvestmentCsv() {
    const rows=investmentRows().map(row=>[row.month,row.year,row.budget,row.linkedin,row.google,totalSpend(row),row.budget?totalSpend(row)/row.budget*100:0,row.budget-totalSpend(row),row.leads??'']);
    downloadCsv(`spira-inversion-${state.year}.csv`,['Mes','Año','Presupuesto USD','LinkedIn USD','Google USD','Total invertido USD','Consumo %','Saldo USD','Leads'],rows);
  }

  function bindEvents() {
    $$('.nav-link').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
    $('#menuToggle').addEventListener('click',openSidebar);
    $('#sidebarClose').addEventListener('click',closeSidebar);
    $('#sidebarBackdrop').addEventListener('click',closeSidebar);
    $('#printButton').addEventListener('click',()=>window.print());
    $('#exportButton').addEventListener('click',exportCurrentView);
    $('#investmentCsvButton').addEventListener('click',exportInvestmentCsv);
    $('#countryFilter').addEventListener('change',event=>{
      state.country=event.target.value;
      if (state.view === 'overview') syncCommercialOptions();
      renderCurrentView();updateUrl();
    });
    $('#commercialFilter').addEventListener('change',event=>{
      state.commercial=event.target.value;
      renderOverview();updateUrl();
    });
    $('#yearFilter').addEventListener('change',event=>{
      if (state.view === 'ads') {
        state.adsYear=event.target.value==='all'?'all':Number(event.target.value);
        syncMonthOptions();
        renderAds();updateUrl();
        return;
      }
      if (state.view === 'digital') {
        state.digitalYear=event.target.value==='all'?'all':Number(event.target.value);
        renderDigital();updateUrl();
        return;
      }
      state.year=event.target.value==='all'?'all':Number(event.target.value);
      syncMonthOptions();
      if (state.view === 'investment') renderInvestment();
      else { syncCommercialOptions(); renderOverview(); }
      updateUrl();
    });
    $('#monthFilter').addEventListener('change',event=>{
      const value=event.target.value==='all'?'all':Number(event.target.value);
      if (state.view === 'digital') {
        state.digitalMonth=value;
        renderDigital(); updateUrl(); return;
      }
      if (state.view === 'ads') {
        state.adsMonth=value;
        renderAds(); updateUrl(); return;
      }
      if (state.view === 'overview') {
        state.overviewMonth=value;
        syncCommercialOptions();
        renderOverview(); updateUrl(); return;
      }
      state.month=value;
      $('#countryMonthFilter').value=String(state.month);
      renderInvestment(); updateUrl();
    });
    $('#countryMonthFilter').addEventListener('change',event=>{
      state.month=event.target.value==='all'?'all':Number(event.target.value);
      $('#monthFilter').value=String(state.month);
      renderInvestment();
      updateUrl();
    });
    $('#countryMetricFilter').addEventListener('change',event=>{state.countryMetric=event.target.value;renderCountryBudget();});
    $$('[data-country-mode]').forEach(button=>button.addEventListener('click',()=>setCountryMode(button.dataset.countryMode)));
    $('#digitalChannelFilter')?.addEventListener('change',event=>{state.digitalChannel=event.target.value;renderDigital();updateUrl();});
    $('#digitalStatusFilter')?.addEventListener('change',event=>{state.digitalStatus=event.target.value;renderDigital();updateUrl();});
    window.addEventListener('resize',()=>{
      if (innerWidth>1024) closeSidebar();
    });
  }

  // Convierte "3 de septiembre de 2026" en "3 Sep 2026" para badges compactos.
  function shortDateEs(fullDateEs) {
    const match = /^(\d{1,2}) de (\S+) de (\d{4})/.exec(fullDateEs || '');
    if (!match) return fullDateEs || '';
    const [, day, monthName, year] = match;
    const idx = monthNames.findIndex(name => name && name.toLowerCase() === monthName.toLowerCase());
    const short = idx > 0 ? monthShortNames[idx] : monthName.slice(0, 3);
    return `${day} ${short} ${year}`;
  }

  // Las fechas "Corte"/"Snapshot" de la tarjeta de marca y los chips de fuente
  // vivían como texto fijo en index.html y nunca se actualizaban. Ahora se
  // toman de DATA.meta.cutoff / DATA.commercial.validation.commercialRowsSnapshot
  // / DATA.investment.snapshot, que la sincronización diaria con Notion ya
  // mantiene al día.
  function renderMetaBadges() {
    const cutoffFull = (DATA.meta && DATA.meta.cutoff) || '';
    const cutoffDate = cutoffFull.split('·')[0].trim();
    const cutoffEl = $('#metaCutoffDate');
    if (cutoffEl && cutoffDate) cutoffEl.textContent = cutoffDate;

    const commercialSnapshot = (DATA.commercial && DATA.commercial.validation && DATA.commercial.validation.commercialRowsSnapshot) || '';
    const overviewDateEl = $('#overviewSourceDate');
    if (overviewDateEl && commercialSnapshot) overviewDateEl.textContent = shortDateEs(commercialSnapshot);

    const commercialBadge = $('#commercialBreakdownBadge');
    if (commercialBadge && commercialSnapshot) commercialBadge.textContent = `Notion · ${shortDateEs(commercialSnapshot)}`;

    const investmentSnapshot = (DATA.investment && DATA.investment.snapshot) || '';
    const adsChip = $('#adsSourceChip');
    if (adsChip && investmentSnapshot) adsChip.textContent = `Inversión: Notion · Leads: Listado de Leads entregados · ${shortDateEs(investmentSnapshot)}`;

    const investmentSnapshotEl = $('#investmentSnapshotDate');
    if (investmentSnapshotEl && investmentSnapshot) investmentSnapshotEl.textContent = investmentSnapshot;
  }

  function init() {
    renderMetaBadges();
    populateFilters();
    bindEvents();
    setCountryMode('chart');
    setView(state.view,{skipRender:true});
    renderCurrentView();
  }

  init();
})();
