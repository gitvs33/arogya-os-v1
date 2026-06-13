"""Views package — domain-split view modules.

This module re-exports everything from each domain module so that
existing ``from .views import ...`` statements continue to work.
"""
from ..auth.views import *  # noqa: F401, F403
from .patients import *  # noqa: F401, F403
from .encounters import *  # noqa: F401, F403
from .sync import *  # noqa: F401, F403
from .ddi import *  # noqa: F401, F403
from .billing import *  # noqa: F401, F403
from .clinical import *  # noqa: F401, F403
from .dashboard import *  # noqa: F401, F403
from .scribe import *  # noqa: F401, F403
from .teleicu import *  # noqa: F401, F403
from .lab import *  # noqa: F401, F403
from .pharmacy import *  # noqa: F401, F403
from .appointments import *  # noqa: F401, F403
from .ward import *  # noqa: F401, F403
