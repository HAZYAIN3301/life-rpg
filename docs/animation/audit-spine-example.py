#!/usr/bin/env python3
"""Read an official Mix and Match ZIP; emit measurements, never execute its code.

Usage: python3 docs/animation/audit-spine-example.py /path/to/mix-and-match.zip
No downloads, extraction, third-party dependencies, or writes. Static data audit,
not a renderer, runtime compatibility check, or artistic acceptance test.
"""
import collections
import hashlib
import json
import math
import sys
import zipfile


def audit(path):
    with zipfile.ZipFile(path) as archive:
        raw = archive.read('export/mix-and-match-pro.json')
        data = json.loads(raw)
        bones = data['bones']
        names = {bone['name'] for bone in bones}
        errors = []
        seen = set()
        for bone in bones:
            if bone['name'] in seen or (bone.get('parent') and bone['parent'] not in seen):
                errors.append('duplicate bone or parent order: ' + bone['name'])
            seen.add(bone['name'])
        slots = {slot['name'] for slot in data['slots']}
        types = collections.Counter()
        weighted_vertices = 0
        influences = 0
        max_influences = 0
        max_weight_error = 0
        skin_rows = []
        for skin in data['skins']:
            count = 0
            for bone in skin.get('bones', []):
                if bone not in names:
                    errors.append('missing skin bone: ' + bone)
            for slot, attachments in skin.get('attachments', {}).items():
                if slot not in slots:
                    errors.append('missing slot: ' + slot)
                for name, attachment in attachments.items():
                    count += 1
                    kind = attachment.get('type', 'region')
                    types[kind] += 1
                    if kind != 'mesh':
                        continue
                    vertex_count = len(attachment['uvs']) // 2
                    if any(i < 0 or i >= vertex_count for i in attachment['triangles']):
                        errors.append('triangle index: ' + name)
                    vertices = attachment['vertices']
                    if len(vertices) == vertex_count * 2:
                        continue
                    position = 0
                    for _ in range(vertex_count):
                        n = vertices[position]
                        position += 1
                        assert isinstance(n, int) and n > 0
                        weights = []
                        for _ in range(n):
                            bone, x, y, weight = vertices[position:position + 4]
                            position += 4
                            if not (0 <= bone < len(bones)) or not all(math.isfinite(v) for v in (x, y, weight)) or weight < 0:
                                errors.append('invalid influence: ' + name)
                            weights.append(weight)
                        max_weight_error = max(max_weight_error, abs(sum(weights) - 1))
                        weighted_vertices += 1
                        influences += n
                        max_influences = max(max_influences, n)
                    assert position == len(vertices), name
            skin_rows.append({'name': skin['name'], 'attachments': count,
                              'optionalBones': len(skin.get('bones', []))})
        constraints = data.get('constraints')
        if constraints is None:
            constraints = sum((data.get(k, []) for k in ('ik', 'transform', 'path', 'physics')), [])
        return {
            'source': 'https://esotericsoftware.com/spine-examples-mix-and-match',
            'exportVersion': data['skeleton']['spine'],
            'jsonSHA256': hashlib.sha256(raw).hexdigest(),
            'bones': len(bones), 'slots': len(slots), 'constraints': len(constraints),
            'skinCount': len(data['skins']), 'skins': skin_rows,
            'animations': {name: list(animation) for name, animation in data['animations'].items()},
            'attachmentTypes': dict(types), 'weightedMeshVerticesAcrossAllSkins': weighted_vertices,
            'influencesAcrossAllSkins': influences, 'maxInfluencesPerVertex': max_influences,
            'maxWeightSumError': max_weight_error,
            'exportBytes': {i.filename: i.file_size for i in archive.infolist()
                            if i.filename.startswith('export/') and not i.is_dir()},
            'errors': errors,
            'limits': 'Static schema subset only; does not evaluate poses, all constraints, seams, or visual quality.'
        }


if __name__ == '__main__':
    print(json.dumps(audit(sys.argv[1]), ensure_ascii=False, indent=2))
