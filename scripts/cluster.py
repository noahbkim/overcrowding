"""Modify the cluster data so that schools reference their cluster."""

from shapely import geometry
import json


with open("../data/build/clusters.geojson") as file:
    clusters = json.load(file)

with open("../data/build/schools.geojson") as file:
    schools = json.load(file)

mapping = {}
for school in schools["features"]:
    point = geometry.Point(school["geometry"]["coordinates"])
    for cluster in clusters["features"]:
        shape = geometry.shape(cluster["geometry"])
        if shape.contains(point):
            mapping[school["properties"]["s_id3"]] = cluster["properties"]["id"]

with open("../data/build/clusters.topojson") as file:
    clusters = json.load(file)

for school in clusters["objects"]["schools"]["geometries"]:
    school["properties"]["cluster"] = mapping[school["properties"]["s_id3"]]

with open("../data/clusters.topojson", "w") as file:
    json.dump(clusters, file)
