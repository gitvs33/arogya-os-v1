"""Domain-aligned model package.

Models are split by domain into sub-modules for maintainability.
All classes are re-exported here so ``from medos.models import X`` still works.
"""
from .auth import *   # noqa: F401, F403
from .patient import *   # noqa: F401, F403
from .clinical import *   # noqa: F401, F403
from .billing import *   # noqa: F401, F403
from .lab import *   # noqa: F401, F403
from .icu import *   # noqa: F401, F403
from .analytics import *   # noqa: F401, F403
from .sync import *   # noqa: F401, F403
from .hospital import *   # noqa: F401, F403
from .admin import *   # noqa: F401, F403
from .appointments import *   # noqa: F401, F403
from .pharmacy import *   # noqa: F401, F403
from .ward import *   # noqa: F401, F403
