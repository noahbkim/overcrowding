/** MCPS Overcrowding
 *
 * Developed by Noah Kim (noahbkim@gmail.com)
 * If you're reading this, please hire me! Check out my website, https://noahbkim.com
 */

/* Take snapshot of window size, not conducive to resizing. */
const W = window.innerWidth - 350;
const H = window.innerHeight;

CAPACITY = "Capacity";
ENROLLMENT = "Enrollment";


/* Selection modes. */
const MODE = {NONE: 0, SCHOOL: 1, CLUSTER: 2};

/* URL prefixes. */
const PREFIX = ""; //"overcrowding/"

/* Grab the UI for convenience. */
const title = d3.select("#title");
const report = d3.select("#report");


/* Teardrop marker SVG path. */
function teardrop(c) { return "M " + c[0] + "," + c[1] + " c -5,-7 -5,-14 -5,-15 c 0,-7 10,-7 10,0 c 0,1 0,8 -5,15 z" }
function circle(c) { return "M " + (c[0] - 5) + "," + c[1] + " a 5,5 0 1,0 10 0 a -5,5 0 1,0 -10 0 z" }
function triangle(c) { return "M " + c[0] + "," + (c[1] + 6.5) + " l 5,-9.75 l -10,0 z" }
function diamond(c) { return "M " + c[0] + "," + (c[1] + 6) + " l 6,-6 l -6,-6 l -6,6 z" }
const MARK = {ES: circle, MS: triangle, HS: diamond};


/** A wrapper for SVG controls. */
class Renderer {

  /** Construct the renderer based on the SVG element. */
  constructor(svg) {
    this.projection = d3.geo.albers().scale(1).translate([0, 0]);  // Projection of map to SVG
    this.path = d3.geo.path().projection(this.projection);  // Path used for drawing map
    this.svg = svg;
    this.background();
    this.g = svg.append("g");
  }

  /** Center the SVG on an arbitrary coordinate. */
  center(bounds) {
    let scale = .95 / Math.max(
      (bounds[1][0] - bounds[0][0]) / W,
      (bounds[1][1] - bounds[0][1]) / H);
    let offset = [
      (W - scale * (bounds[1][0] + bounds[0][0])) / 2,
      (H - scale * (bounds[1][1] + bounds[0][1])) / 2];
    this.projection.scale(scale).translate(offset);
  }

  /** Append the background element. */
  background() {
    this.svg.append("rect")
      .attr("class", "background")
      .attr("width", W)
      .attr("height", H);
  }

  /** Provide transforms relative to a position. */
  scale(amount, coordinates) {
    let c = this.projection(coordinates);
    let x = c[0] * (1 - amount);
    let y = c[1] * (1 - amount);
    return "translate(" + x + "," + y + ")scale(" + amount + ")";
  }

  /** Generate a mark path pointed at the current SVG coordinate. */
  mark(marker, coordinates) {
    let c = this.projection(coordinates);
    return (marker || teardrop)(c) ;
  }

}


/** A gradient utility for scales. */
class Gradient {

  constructor() {
    this.stops = [];
    this.lookup = {};
  }

  stop(position, color) {
    this.stops.push(position);
    this.stops.sort();
    this.lookup[position] = color;
    return this;
  }

  interpolate(position) {
    let a = 0;
    let b = 1;
    for (let i = 0; i < this.stops.length; i++) {
      if (this.stops[i] < position) {
        a = this.stops[i];
      } else if (this.stops[i] > position) {
        b = this.stops[i];
        break;
      } else return this.lookup[position];
    }
    let s = (position - a) / (b - a);
    let c = this.lookup[a];
    let d = this.lookup[b];
    return [
      Math.round(c[0] + s * (d[0] - c[0])),
      Math.round(c[1] + s * (d[1] - c[1])),
      Math.round(c[2] + s * (d[2] - c[2]))];
  }

  color(position, alpha) {
    return "rgba(" + this.interpolate(position).concat(alpha || 1).join(", ") + ")";
  }

  svg(gradient, alpha) {
    for (let stop of this.stops)
      gradient.append("stop")
        .attr("offset", stop * 100 + "%")
        .attr("style", "stop-color: rgba(" + this.lookup[stop].concat(alpha || 1).join(", ") + ");");
  }

}


/** Binned gradient. */
class BinnedGradient {

  constructor(colors) {
    this.colors = colors;
  }

  color(position, alpha) {
    let index = Math.floor(position * this.colors.length);
    if (index === this.colors.length) index--;
    return this.rgba(this.colors[index]);
  }

  rgba(rgb, alpha) {
    return "rgba(" + rgb.concat(alpha || 1).join(", ") + ")";
  }

  draw(g, x, y, w, h, a) {
    g.append("rect").attr("x", x).attr("y", y).attr("width", w).attr("height", h).style("outline", "black");
    x += 1;
    y += 1;
    w -= 2;
    h -= 2;
    let l = w / this.colors.length;
    for (let i = 0; i < this.colors.length; i++) {
      g.append("rect").attr("x", Math.floor(x + i*l)).attr("y", y)
        .attr("width", Math.ceil(l)).attr("height", h)
        .style("fill", this.rgba(this.colors[i]));
    }
  }

}


/** The data manager for the visualization.
 *
 * The geography data is the central focus of the project, so it is
 * not encapsulated in a plugin but rather managed directly by this
 * instance.
 */
class Data {

  /** Create the data object with container fields. */
  constructor(plugins) {
    this.clusters = null;
    this.schools = null;
    this.plugins = plugins;
  }

  /** Start downloading data. */
  download(callback) {
    let q = queue().defer(d3.json, PREFIX + "data/clusters.topojson");
    for (let plugin of this.plugins)
      q.defer(plugin.parser, plugin.url);
    q.await((error, clusters, ...rest) => {
      if (error) { alert("Failed to load data: " + error); return; }

      /* Prepare the geography data and plugins provided that data. */
      this.prepare(clusters);
      for (let i = 0; i < this.plugins.length; i++)
        this.plugins[i].prepare(rest[i], this.clusters, this.schools)

      /* Finish up and callback. */
      callback();
    });
    console.log("Queued data downloads...");
  }

  /** Prepare and compute features in the dataset. */
  prepare(clusters) {
    this.clusters = clusters;
    this.schools = clusters.objects.schools.geometries;
    this.clusters.geo = topojson.feature(clusters, clusters.objects.clusters);
    this.schools.geo = topojson.feature(clusters, clusters.objects.schools);
  }

}


/** Base class for data plugins to make convenient. */
class DataPlugin {

  /** Download queue functionality. */
  constructor(parser, url) {
    this.parser = parser;
    this.url = url;
  }

  /** Abstract prepare method. */
  prepare(data, clusters, schools) {}

}


/** Heatmap data plugin. */
class CapacityPlugin extends DataPlugin {

  constructor() {
    super(d3.csv, PREFIX + "data/capacity.csv");
    this.data = null;
    this.ratios =  {schools: {}, clusters: {}, total: [0, 0]};  // Ratios of enrollment to capacity
    this.scales = {  // Min and max ratios
      schools: [Infinity, -Infinity],
      clusters: [Infinity, -Infinity],
      enrollment: [Infinity, -Infinity]};
    this.gradient = new BinnedGradient([
      [247,252,240],
      [224,243,219],
      [204,235,197],
      [168,221,181],
      [123,204,196],
      [78,179,211],
      [43,140,190],
      [8,104,172],
      [8,64,129]]);
  }

  /** Compute capacity and enrollment. */
  prepare(data, clusters, schools) {
    this.data = data;
    let capacity, enrollment;
    for (let school of schools) {

      /* Grab and check capacity and enrollment numbers. */
      let schoolId = school["properties"]["s_id3"];
      let clusterId = school["properties"]["cluster"];
      capacity = parseFloat(this.search(schoolId, "2016", CAPACITY) || "0");
      enrollment = parseFloat(this.search(schoolId, "2016", ENROLLMENT) || "0");
      if (capacity && enrollment) {

        /* School ratios and scales, only because we're already iterating through. */
        this.ratios.schools[schoolId] = [enrollment, capacity];
        this.scales.schools[0] = Math.min(this.scales.schools[0], enrollment / capacity);
        this.scales.schools[1] = Math.max(this.scales.schools[1], enrollment / capacity);
        this.scales.enrollment[0] = Math.min(this.scales.enrollment[0], enrollment);
        this.scales.enrollment[1] = Math.max(this.scales.enrollment[1], enrollment);

        /* Cluster ratios. */
        if (!this.ratios.clusters.hasOwnProperty(clusterId))
          this.ratios.clusters[clusterId] = [0, 0];
        this.ratios.clusters[clusterId][0] += enrollment;
        this.ratios.clusters[clusterId][1] += capacity;

        /* Total ratios. */
        this.ratios.total[0] += enrollment;
        this.ratios.total[1] += capacity;

      }

      /* Compute cluster ratios after because we have to wait for all ratios. */
      let ratios = Object.values(this.ratios.clusters).map(x => x[0] / x[1]);
      this.scales.clusters[0] = Math.min.apply(Math, ratios);
      this.scales.clusters[1] = Math.max.apply(Math, ratios);
    }
  }

  /** Search the CSV by column parameters. */
  search(schoolId, year, entryType) {
    let entry = this.data.filter(c =>
      c["sch_id"] === schoolId && c["year"] === year && c["Type"] === entryType)[0];
    if (!entry) return null;
    return entry["Value"];
  }

  /** Provide a heatmap color for a cluster. */
  getClusterColor(cluster) {
    let ratio = this.ratios.clusters[cluster["properties"]["id"]];
    let scale = this.scales.clusters;
    let value = (ratio[0] / ratio[1] - scale[0]) / (scale[1] - scale[0]);
    return this.gradient.color(value, 1);
  }

  /** Generate an SVG gradient for the scale. */
  addClusterGradient(defs) {
    this.gradient.svg(defs.append("linearGradient")
      .attr("id", "clusterGradient")
      .attr("x1", "0%").attr("x2", "100%")
      .attr("y1", "0%").attr("y2", "0%"));
  }

  /** Get a ratio size of a school. */
  getSchoolSize(school) {
    let base = 0.6;
    let ratio = this.ratios.schools[school["properties"]["s_id3"]];
    if (!ratio) return base;
    let scale = this.scales.enrollment;
    return base * (ratio[0] - scale[0]) / (scale[1] - scale[0]) + 1 - 0.225;
  }

  /** Provide a heatmap color for a school. */
  getSchoolColor(school) {
    let ratio = this.ratios.schools[school["properties"]["s_id3"]];
    if (!ratio) return "rgba(144, 144, 144, 1)";
    let scale = this.scales.schools;
    let value = (ratio[0] / ratio[1] - scale[0]) / (scale[1] - scale[0]);
    return this.gradient.color(value);
  }

}


/** The central application controller. */
class Controller {

  /** Initialize a new application. */
  constructor() {
    this.capacity = new CapacityPlugin();
    this.data = new Data([this.capacity]);
    this.renderer = new Renderer(d3.select("#overcrowding").append("svg").attr("width", W).attr("height", H));
    this.objects = {county: null, clusters: null, schools: null};  // drawn objects
    this.selection = {cluster: null, school: null};
    this.overlay = this.renderer.svg.append("g");
    this.hover = null;
    this.mode = MODE.NONE;
  }

  /* MARK: Application controls */

  /** Start the application runtime. */
  start() {
    this.data.download(this.main.bind(this));
  }

  /** Draw the visualization and apply data. */
  main() {
    this.draw();
    this.apply();
  }

  /* MARK: Drawing controls */

  /** Center the renderer and draw the clusters. */
  draw() {
    console.log("Drawing visualization...");
    this.renderer.center(this.renderer.path.bounds(this.data.clusters.geo));
    this.drawClusters();
    // this.drawCompass();
    this.drawHover();
    // this.drawBorders();
    this.drawScale();
  }

  /** Draw the county clusters, bind the click events. */
  drawClusters() {
    this.objects.clusters = this.renderer.g.append("g").attr("class", "clusters")
      .selectAll("path")
      .data(this.data.clusters.geo.features).enter().append("path")
      .attr("d", this.renderer.path)
      .attr("class", "cluster")
      .on("click", this.selectCluster.bind(this))
      .on("mouseenter", this.hoverCluster.bind(this));
  }

  /** Draw borders between the cluster regions. */
  drawBorders() {
    this.renderer.g.append("path")
      .datum(topojson.mesh(this.data.clusters, this.data.clusters.objects.clusters, (a, b) => a !== b))
      .attr("d", this.renderer.path)
      .attr("class", "border");
    this.renderer.g.append("path")
      .datum(topojson.merge(this.data.clusters, this.data.clusters.objects.clusters.geometries))
      .attr("d", this.renderer.path)
      .attr("class", "border")
  }

  /** Draw schools for a particular cluster. */
  drawSchools(clusterId) {
    this.objects.schools = this.renderer.g.append("g").attr("class", "schools")
      .selectAll("path")

      /* Filter by schools in cluster and sort by y position to make natural overlap. */
      .data(this.data.schools.geo.features
        .filter(s => s["properties"]["cluster"] === clusterId)
        .sort((a, b) => b.geometry.coordinates[1] - a.geometry.coordinates[1])).enter()

      /* Draw each school. */
      .append("path")
        .attr("d", school => this.renderer.mark(
          MARK[school.properties.schooltype], school.geometry.coordinates))
        .attr("transform", school => this.renderer.scale(
          this.capacity.getSchoolSize(school), school.geometry.coordinates))
        .attr("class", "school")
        .style("stroke", "black")
        .style("stroke-width", school => 1 / this.capacity.getSchoolSize(school))
        .style("fill",  school => this.capacity.getSchoolColor(school))
        .on("click", this.selectSchool.bind(this))
        .on("mouseenter", this.hoverSchool.bind(this));
  }

  /** Remove the active schools. */
  removeSchools() {
    if (this.objects.schools) {
      this.objects.schools.remove();
      this.objects.schools = null;
    }
  }

  /** Draw the text element for hovered items. */
  drawHover() {
    this.hover = this.overlay.append("text")
      .attr("x", 22).attr("y", 40)
      .style("font-size", "22.5px")
      .attr("fill", "#AAA")
      .attr("text-anchor", "start")
      .text("Test")
  }

  /** Draw the capacity scale on the bottom left. */
  drawScale() {
    let scale = this.renderer.svg.append("g");
    this.capacity.gradient.draw(scale, 35, H-38, 200, 10);
    scale.append("text")
      .attr("x", 35).attr("y", H-43)
      .style("font-size", "12px")
      .style("fill", "#AAA")
      .text(Math.round(this.capacity.scales.clusters[0] * 100) + "%");
    scale.append("text")
      .attr("x", 235).attr("y", H-43)
      .style("font-size", "12px")
      .style("fill", "#AAA")
      .attr("text-anchor", "end")
      .text(Math.round(this.capacity.scales.clusters[1] * 100) + "%");
  }

  /** Draw a compass rose in the top left of the visualization. */
  drawCompass() {
    this.overlay.append("polygon")
      .attr("points", "51,55 54.5,50 58,55")
      .style("fill", this.capacity.gradient.color(1));
    this.overlay.append("text")
      .attr("x", 50).attr("y", 67)
      .attr("font-size", "12px")
      .attr("fill", "#AAA")
      .text("N")
      .style("font", "Arial")
  }

  /* MARK: Data controls */

  /** Apply data to the visualization and statistics. */
  apply() {
    console.log("Applying data...");
    this.applyHeatmap();
    this.overallStatistics();
  }

  /** Color the clusters according to overcrowding. */
  applyHeatmap() {
    this.objects.clusters.style("fill", cluster => this.capacity.getClusterColor(cluster));
  }

  /* MARK: Interactivity */

  /** Find the center and zoom for the state. */
  viewCluster(cluster) {

    /* Find the cluster and retrieve bounds. */
    let x, y, w, h, k;
    if (cluster && cluster !== this.selection.cluster) {
      let bounds = this.renderer.path.bounds(cluster);
      x = (bounds[1][0] + bounds[0][0]) / 2;
      y = (bounds[1][1] + bounds[0][1]) / 2;
      w = bounds[1][0] - bounds[0][0];
      h = bounds[1][1] - bounds[0][1];
      k = 1 / (1.2 * Math.max(w / W, h / H));
      this.selection.cluster = cluster;

    /* If selection is the same or cluster is null, zoom out. */
    } else {
      x = W / 2;
      y = H / 2;
      k = 1;
      this.selection.cluster = null;
    }

    /* Set the path as active and zoom. */
    this.renderer.g.selectAll("path")
      .classed("background", this.selection.cluster && (cluster => cluster !== this.selection.cluster));
    this.renderer.g.transition().duration(750)
      .attr("transform", "translate(" + W/2 + "," + H/2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-W", 1.5 / k + "px");

  }

  /** Callback for selecting a cluster. */
  selectCluster(cluster) {

    if (cluster && cluster !== this.selection.cluster) {
      this.removeSchools();
      this.drawSchools(cluster["properties"]["id"]);
      this.clusterStatistics(cluster);
      this.mode = MODE.CLUSTER;
    } else if (this.mode === MODE.SCHOOL) {
      this.selectSchool(null);
      this.clusterStatistics(cluster);
      this.mode = MODE.CLUSTER;
      return;
    } else {
      this.clusterStatistics(null);
      this.removeSchools();
    }

    this.viewCluster(cluster);

  }

  selectSchool(school) {
    if (school && school !== this.selection.school) {
      this.selection.school = school;
      this.schoolStatistics(school);
      this.mode = MODE.SCHOOL;
    } else {
      this.selection.school = null;
      this.mode = MODE.CLUSTER;
      this.clusterStatistics(this.selection.cluster);
    }

    this.renderer.g.selectAll("path")
      .classed("active", this.selection.school && (school => school === this.selection.school));
  }

  hoverCluster(cluster) {
    this.hover.text(cluster["properties"]["name"])
  }

  hoverSchool(school) {
    this.hover.text(school["properties"]["school"])
  }

  /** Fill in statistics on the overall view.*/
  overallStatistics() {
    let enrollment = Math.round(this.capacity.ratios.total[0] / this.capacity.ratios.total[1] * 100);
    let schools = Object.values(this.capacity.ratios.schools);
    let over = schools.filter(t => t[0] > t[1]).length;
    title.text("Montgomery County");
    report.html([
      "<h2>Capacity</h2>" +
      "Capacity: " + this.capacity.ratios.total[0] + " (" + enrollment + "%)",
      "Enrollment: " + this.capacity.ratios.total[1],
      "Total schools: " + schools.length,
      "Over-enrolled: " + over + " (" + Math.round(over / schools.length * 100) + "%)"
    ].join("<br>"));
  }

  clusterStatistics(cluster) {
    if (cluster === null) return;
    let clusterId = cluster["properties"]["id"];
    let ratio = this.capacity.ratios.clusters[clusterId];
    title.text(cluster["properties"]["name"]);
    report.html([
      "<h2>Capacity</h2>" +
      "Capacity: " + ratio[1],
      "Enrollment: " + ratio[0],
      "Over-enrollment: " + Math.round(100 * ratio[0] / ratio[1]) + "%"
    ].join("<br>"));
  }

  schoolStatistics(school) {
    let schoolId = school["properties"]["s_id3"];
    let ratio = this.capacity.ratios.schools[schoolId];
    title.text(school["properties"]["school"]);
    report.html([
      "<h2>Capacity</h2>" +
      "Capacity: " + ratio[1],
      "Enrollment: " + ratio[0],
      "Over-enrollment: " + Math.round(100 * ratio[0] / ratio[1]) + "%"
    ].join("<br>"));
  }

}


const controller = new Controller();
controller.start();
